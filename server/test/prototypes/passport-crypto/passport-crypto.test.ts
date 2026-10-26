import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { context, document, grant, nowMs, sensitiveSentinels } from './fixtures.js';
import { offlineBoundary } from './fixtures.js';
import { CryptoError, SyntheticProviderFailure, type CryptoOptions, type DecryptionAuthorizationPolicy, type OperationControl, type CryptoEnvelopeV1, type DataKeyProvider, type WrappedDataKey } from './contracts.js';
import { canonicalAAD, contextSnapshot, decodeBase64, decodePayload, encodePayload, parseEnvelope } from './envelope-codec.js';
import { PassengerDocumentCrypto, SyntheticAuthorizationPolicy } from './passenger-document-crypto.js';
import { SyntheticKmsAdapter } from './synthetic-kms-adapter.js';

let provider: SyntheticKmsAdapter;
let crypto: PassengerDocumentCrypto;
beforeEach(() => {
  expect(offlineBoundary.installed).toBe(true);
  provider = new SyntheticKmsAdapter();
  crypto = new PassengerDocumentCrypto(provider, new SyntheticAuthorizationPolicy(() => nowMs));
});
afterEach(() => { provider.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); });
const reject = (promise: Promise<unknown>, code: string) => expect(promise).rejects.toMatchObject({ code });
function flip(value: string): string { const b = Buffer.from(value, 'base64url'); b[0] ^= 1; return b.toString('base64url'); }
async function envelope(): Promise<CryptoEnvelopeV1> { return crypto.encrypt(document, context); }

describe('01 synthetic round trip', () => {
  it('round trips grouped values and serialized envelope without plaintext fields', async () => {
    const e = await envelope();
    expect(await crypto.decrypt(JSON.stringify(e), context, grant)).toEqual(document);
    for (const sentinel of sensitiveSentinels) expect(JSON.stringify(e)).not.toContain(sentinel);
    expect(Object.isFrozen(e)).toBe(true);
  });
  it('omits absent optional fields', async () => {
    const payload = { dateOfBirth: '2000-01-01' };
    expect(await crypto.decrypt(await crypto.encrypt(payload, context), context, grant)).toEqual(payload);
  });
  it('rejects empty payloads', async () => { await reject(crypto.encrypt({}, context), 'INVALID_INPUT'); });
});

describe('02 ciphertext tampering', () => {
  it.each(['flip', 'truncate', 'append'])('rejects %s without output', async operation => {
    const e = await envelope();
    const bytes = decodeBase64(e.ciphertext);
    const ciphertext = operation === 'flip' ? flip(e.ciphertext) : (operation === 'truncate' ? bytes.subarray(0, -1) : Buffer.concat([bytes, Buffer.from([0])])).toString('base64url');
    await reject(crypto.decrypt({ ...e, ciphertext }, context, grant), 'INTEGRITY_FAILURE');
  });
});

describe('03 authentication tag', () => {
  it('rejects modified tag', async () => { const e = await envelope(); await reject(crypto.decrypt({ ...e, tag: flip(e.tag) }, context, grant), 'INTEGRITY_FAILURE'); });
  it.each([0, 15, 17])('rejects %i-byte tag before unwrap', async size => {
    const e = await envelope();
    await reject(crypto.decrypt({ ...e, tag: Buffer.alloc(size).toString('base64url') }, context, grant), 'INVALID_ENVELOPE');
    expect(provider.calls.unwrap).toBe(0);
  });
});

describe('04 canonical AAD', () => {
  it('has exact fixed-order UTF-8 bytes independent of input property order', () => {
    const expected = '["FlyWithSafe","passenger-document","1","synthetic-offline","synthetic-booking-1","synthetic-passenger-1"]';
    expect(canonicalAAD({ passengerId: context.passengerId, environmentId: context.environmentId, bookingId: context.bookingId })).toEqual(Buffer.from(expected));
  });
  it.each(['x:y', 'a"b', 'a\\b', 'é', '', 'a\n', 'x'.repeat(65)])('rejects noncanonical identifier %j', id => {
    expect(() => canonicalAAD({ ...context, passengerId: id })).toThrow(CryptoError);
  });
  it('rejects arbitrary domain/context properties', () => { expect(() => canonicalAAD({ ...context, domain: 'other' })).toThrow(CryptoError); });
  it('snapshots and freezes mutable contexts', () => {
    const mutable = { ...context }; const snapshot = contextSnapshot(mutable); mutable.bookingId = 'changed';
    expect(snapshot.bookingId).toBe(context.bookingId); expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

describe('05 context binding', () => {
  it.each(['environmentId', 'bookingId', 'passengerId'] as const)('rejects changed %s even with matching grant', async field => {
    const e = await envelope(); const changed = { ...context, [field]: 'synthetic-other' };
    await reject(crypto.decrypt(e, changed, { ...grant, ...changed }), 'INTEGRITY_FAILURE');
  });
  it('authenticates content AAD independently of key wrapping', async () => {
    const e = await envelope(); const changed = { ...context, passengerId: 'synthetic-other' };
    const dek = await provider.unwrapDataKey(e, context);
    const fake: DataKeyProvider = { createAndWrapDataKey: c => provider.createAndWrapDataKey(c), unwrapDataKey: async () => dek };
    await reject(new PassengerDocumentCrypto(fake, new SyntheticAuthorizationPolicy(() => nowMs)).decrypt(e, changed, { ...grant, ...changed }), 'INTEGRITY_FAILURE');
    expect(dek.every(b => b === 0)).toBe(true);
  });
});

describe('06 authorization before unwrap', () => {
  it.each([
    null, {}, { ...grant, actorId: '' }, { ...grant, role: 'ADMIN' }, { ...grant, role: 'CUSTOMER' },
    { ...grant, bookingId: 'other' }, { ...grant, passengerId: 'other' }, { ...grant, environmentId: 'other' },
    { ...grant, purpose: 'support' }, { ...grant, expiresAtMs: nowMs }, { ...grant, expiresAtMs: NaN },
    { ...grant, stepUpVerified: false }, { ...grant, extra: true },
  ])('denies invalid grant %# with zero unwrap calls', async invalid => {
    await reject(crypto.decrypt(await envelope(), context, invalid), 'FORBIDDEN');
    expect(provider.calls.unwrap).toBe(0);
  });
  it('sanitizes policy exceptions', async () => {
    const cipher = new PassengerDocumentCrypto(provider, { assertAllowed: () => { throw Error(sensitiveSentinels.join(' ')); } });
    await reject(cipher.decrypt(await envelope(), context, grant), 'FORBIDDEN'); expect(provider.calls.unwrap).toBe(0);
  });
});

describe('07 fake outage and bounded retries', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
  it('stops after three creation attempts', async () => {
    provider.mode = 'unavailable'; const check = reject(envelope(), 'KEY_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(75); await check; expect(provider.calls.create).toBe(3);
  });
  it('stops after three unwrap attempts', async () => {
    const e = await envelope(); provider.mode = 'unavailable';
    const check = reject(crypto.decrypt(e, context, grant), 'KEY_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(75); await check; expect(provider.calls.unwrap).toBe(3);
  });
  it('recovers within bounded attempts', async () => {
    provider.transientFailures = 2; const pending = envelope(); await vi.advanceTimersByTimeAsync(75);
    const e = await pending; expect(provider.calls.create).toBe(3);
    expect(await crypto.decrypt(e, context, grant)).toEqual(document);
  });
  it.each([0, 4, 1.5, NaN])('rejects invalid attempt budget %s', attempts => {
    expect(() => new PassengerDocumentCrypto(provider, new SyntheticAuthorizationPolicy(), attempts)).toThrow(CryptoError);
  });
});

describe('08 provider denial', () => {
  it('does not retry denied creation', async () => {
    provider.mode = 'denied'; await reject(envelope(), 'KEY_ACCESS_DENIED'); expect(provider.calls.create).toBe(1);
  });
  it('does not retry denied unwrap', async () => {
    const e = await envelope(); provider.mode = 'denied'; await reject(crypto.decrypt(e, context, grant), 'KEY_ACCESS_DENIED'); expect(provider.calls.unwrap).toBe(1);
  });
});

describe('09 metadata/version allowlists', () => {
  it.each([
    ['payloadVersion', 2, 'UNSUPPORTED_VERSION'], ['aadVersion', 2, 'UNSUPPORTED_VERSION'],
    ['algorithm', 'AES-128-GCM', 'INVALID_ENVELOPE'], ['keyProvider', 'aws', 'INVALID_ENVELOPE'],
    ['keyRef', 'https://not-an-endpoint.invalid', 'INVALID_ENVELOPE'], ['keyVersion', 'v3', 'INVALID_ENVELOPE'],
    ['wrapAlgorithm', 'RSA', 'INVALID_ENVELOPE'], ['extra', true, 'INVALID_ENVELOPE'],
  ])('rejects %s before provider use', async (field, value, code) => {
    const e = await envelope(); await reject(crypto.decrypt({ ...e, [String(field)]: value }, context, grant), String(code)); expect(provider.calls.unwrap).toBe(0);
  });
  it('rejects wrapped-key tampering', async () => {
    const e = await envelope(); await reject(crypto.decrypt({ ...e, wrappedDek: flip(e.wrappedDek) }, context, grant), 'INTEGRITY_FAILURE');
    expect(provider.calls.unwrap).toBe(1);
  });
  it('does not use a different fake provider key', async () => {
    const other = new SyntheticKmsAdapter();
    try { await reject(new PassengerDocumentCrypto(other, new SyntheticAuthorizationPolicy(() => nowMs)).decrypt(await envelope(), context, grant), 'INTEGRITY_FAILURE'); }
    finally { other.dispose(); }
  });
});

describe('10 DEK/nonce freshness', () => {
  it('uses new DEKs and 12-byte nonces on repeated writes', async () => {
    const e1 = await envelope(), e2 = await envelope();
    const k1 = await provider.unwrapDataKey(e1, context), k2 = await provider.unwrapDataKey(e2, context);
    try {
      expect(k1.byteLength).toBe(32); expect(k2.byteLength).toBe(32); expect(Buffer.from(k1).equals(Buffer.from(k2))).toBe(false);
      expect(e1.nonce).not.toBe(e2.nonce); expect(decodeBase64(e1.nonce).length).toBe(12); expect(decodeBase64(e1.tag).length).toBe(16);
    } finally { k1.fill(0); k2.fill(0); }
  });
  it('detects repeated DEKs from an injected broken provider in the freshness oracle', async () => {
    const seeded = await provider.createAndWrapDataKey(context);
    const base = Buffer.from(seeded.plaintextDek); seeded.plaintextDek.fill(0);
    try {
      const broken: DataKeyProvider = { createAndWrapDataKey: async () => ({ ...seeded, plaintextDek: Buffer.from(base) }), unwrapDataKey: (m, c) => provider.unwrapDataKey(m, c) };
      const cipher = new PassengerDocumentCrypto(broken, new SyntheticAuthorizationPolicy(() => nowMs));
      const e1 = await cipher.encrypt(document, context), e2 = await cipher.encrypt(document, context);
      const k1 = await provider.unwrapDataKey(e1, context), k2 = await provider.unwrapDataKey(e2, context);
      try {
        const assertFresh = () => { if (Buffer.from(k1).equals(Buffer.from(k2))) throw Error('DUPLICATE_TEST_DEK'); };
        expect(assertFresh).toThrow('DUPLICATE_TEST_DEK');
        expect(e1.nonce).not.toBe(e2.nonce);
      } finally { k1.fill(0); k2.fill(0); }
    } finally { base.fill(0); }
  });
  it('rejects a substituted nonce rather than returning unauthenticated plaintext', async () => {
    const e = await envelope(); await reject(crypto.decrypt({ ...e, nonce: flip(e.nonce) }, context, grant), 'INTEGRITY_FAILURE');
  });
});

describe('11 strict serialization', () => {
  it.each(['1900-02-29', '2025-02-29', '2024-04-31', '0000-01-01', '2024-1-01', '2024-01-01T00:00:00Z'])('rejects calendar date %s', async dateOfBirth => {
    await reject(crypto.encrypt({ dateOfBirth }, context), 'INVALID_INPUT'); expect(provider.calls.create).toBe(0);
  });
  it.each([null, [], { passportNumber: '' }, { passportNumber: ' x ' }, { passportNumber: '\n' }, { passportNumber: undefined }, { token: 'SYNTHETIC' }])('rejects invalid payload %#', async payload => { await reject(crypto.encrypt(payload, context), 'INVALID_INPUT'); });
  it('caps UTF-8 bytes at 4 KiB exactly', async () => {
    const overhead = Buffer.byteLength('{"passportNumber":""}');
    const exact = { passportNumber: 'X'.repeat(4096 - overhead) };
    expect(encodePayload(exact).length).toBe(4096);
    expect(await crypto.decrypt(await crypto.encrypt(exact, context), context, grant)).toEqual(exact);
    await reject(crypto.encrypt({ passportNumber: exact.passportNumber + 'é' }, context), 'INVALID_INPUT');
  });
  it('rejects overlarge encoded envelope and malformed JSON', () => {
    expect(() => parseEnvelope(' '.repeat(16385))).toThrow(CryptoError); expect(() => parseEnvelope('{')).toThrow(CryptoError);
  });
  it.each(['AA=', 'A', 'a+b/', 'AA ', ''])('rejects noncanonical base64url %j', value => { expect(() => decodeBase64(value)).toThrow(CryptoError); });
  it('rejects accessors without executing them', async () => {
    const getter = vi.fn(() => 'SYNTHETIC');
    await reject(crypto.encrypt(Object.defineProperty({}, 'passportNumber', { enumerable: true, get: getter }), context), 'INVALID_INPUT'); expect(getter).not.toHaveBeenCalled();
  });
  it('rejects noncanonical/invalid authenticated plaintext after final verification', async () => {
    for (const bytes of [Buffer.from('{ "passportNumber": "SYNTHETIC" }'), Buffer.from([0xff]), Buffer.from('{"extra":"SYNTHETIC"}')]) {
      const wrapped = await provider.createAndWrapDataKey(context); const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', wrapped.plaintextDek, nonce); cipher.setAAD(canonicalAAD(context));
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]); wrapped.plaintextDek.fill(0);
      const e = { ...wrapped, plaintextDek: undefined, payloadVersion: 1, algorithm: 'AES-256-GCM', aadVersion: 1, nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
      const { plaintextDek: _removed, ...clean } = e;
      await reject(crypto.decrypt(clean, context, grant), 'INVALID_INPUT');
    }
    expect(() => decodePayload(Buffer.from('not JSON'))).toThrow(CryptoError);
  });
});

describe('12 no plaintext logs and 13 sanitized failures', () => {
  it('emits no console messages on success, denial or integrity failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map(key => vi.spyOn(console, key).mockImplementation(() => {}));
    const e = await envelope(); await crypto.decrypt(e, context, grant);
    await reject(crypto.decrypt(e, context, {}), 'FORBIDDEN'); await reject(crypto.decrypt({ ...e, tag: flip(e.tag) }, context, grant), 'INTEGRITY_FAILURE');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
  it('does not expose raw external messages/causes and does not retry unknown failures', async () => {
    const error = Object.assign(new Error(sensitiveSentinels.join(' ')), { code: sensitiveSentinels[0] });
    const create = vi.fn(async (): Promise<WrappedDataKey> => { throw error; });
    const cipher = new PassengerDocumentCrypto({ createAndWrapDataKey: create, unwrapDataKey: async () => { throw error; } }, new SyntheticAuthorizationPolicy(() => nowMs));
    let observed: unknown;
    try { await cipher.encrypt(document, context); } catch (caught) { observed = caught; }
    expect(observed).toBeInstanceOf(CryptoError); expect(create).toHaveBeenCalledTimes(1);
    if (!(observed instanceof CryptoError)) throw Error('Expected sanitized failure');
    expect(Object.keys(observed.toJSON()).sort()).toEqual(['code', 'correlationId']);
    for (const sentinel of sensitiveSentinels) expect(JSON.stringify(observed) + String(observed.stack)).not.toContain(sentinel);
    expect('cause' in observed).toBe(false);
  });
});

describe('15 key lifetime and invalid keys', () => {
  it.each([0, 16, 31, 33])('rejects and clears %i-byte provider DEKs', async length => {
    const real = await provider.createAndWrapDataKey(context); real.plaintextDek.fill(0);
    const invalid = Buffer.alloc(length, 7);
    const cipher = new PassengerDocumentCrypto({ createAndWrapDataKey: async () => ({ ...real, plaintextDek: invalid }), unwrapDataKey: async () => invalid }, new SyntheticAuthorizationPolicy(() => nowMs));
    await reject(cipher.encrypt(document, context), 'KEY_UNAVAILABLE'); expect(invalid.every(b => b === 0)).toBe(true);
    invalid.fill(7); await reject(cipher.decrypt(await envelope(), context, grant), 'KEY_UNAVAILABLE'); expect(invalid.every(b => b === 0)).toBe(true);
  });
  it('clears operation-owned keys after successful encrypt/decrypt and failed tag', async () => {
    const keys: Uint8Array[] = [];
    const instrumented: DataKeyProvider = {
      createAndWrapDataKey: async c => { const result = await provider.createAndWrapDataKey(c); keys.push(result.plaintextDek); return result; },
      unwrapDataKey: async (m, c) => { const key = await provider.unwrapDataKey(m, c); keys.push(key); return key; },
    };
    const cipher = new PassengerDocumentCrypto(instrumented, new SyntheticAuthorizationPolicy(() => nowMs));
    const e = await cipher.encrypt(document, context); await cipher.decrypt(e, context, grant);
    await reject(cipher.decrypt({ ...e, tag: flip(e.tag) }, context, grant), 'INTEGRITY_FAILURE');
    expect(keys).toHaveLength(3); expect(keys.every(k => k.every(b => b === 0))).toBe(true);
    expect(provider.calls.unwrap).toBe(2); // Every read unwraps, no cross-request plaintext cache.
  });
});

describe('16 fake historical keys', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
  it('keeps old envelopes readable until the needed fake key is retired', async () => {
    const old = await envelope(); provider.activeVersion = 'v2'; const current = await envelope();
    expect(current.keyVersion).toBe('v2'); expect(await crypto.decrypt(old, context, grant)).toEqual(document);
    provider.retire('v1'); const check = reject(crypto.decrypt(old, context, grant), 'KEY_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(75); await check;
    expect(await crypto.decrypt(current, context, grant)).toEqual(document);
  });
});

describe('17 rollback limitation', () => {
  it('accepts an older valid same-context envelope, requiring independent revision/CAS', async () => {
    const old = await envelope(); await crypto.encrypt({ passportNumber: 'SYNTHETIC-REPLACEMENT' }, context);
    expect(await crypto.decrypt(old, context, grant)).toEqual(document);
  });
});

// R19: a legitimate policy must return an observed Promise<void>.
if (false) {
  // @ts-expect-error Bare void is deliberately not an asynchronous authorization contract.
  const invalidPolicy: DecryptionAuthorizationPolicy = { assertAllowed: () => {} };
  void invalidPolicy;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function observed<T>(promise: Promise<T>) {
  return promise.then(value => ({ value }), error => ({ error: error as unknown }));
}
// Deliberately malformed dependency injection belongs only in runtime-contract tests.
function faultCipher(p: unknown, policy: unknown, options: CryptoOptions = {}): PassengerDocumentCrypto {
  const result: unknown = Reflect.construct(PassengerDocumentCrypto, [p, policy, 3, { wallNow: () => nowMs, ...options }]);
  if (!(result instanceof PassengerDocumentCrypto)) throw new Error('SYNTHETIC_CONSTRUCTION');
  return result;
}
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

describe('D2 R01-R16 asynchronous orchestration', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
  afterEach(() => { expect(vi.getTimerCount()).toBe(0); });

  it('R01 waits for asynchronous authorization before unwrapping', async () => {
    const e = await envelope(), gate = deferred<void>();
    const policy = { assertAllowed: vi.fn(() => gate.promise) };
    const result = observed(faultCipher(provider, policy).decrypt(e, context, grant));
    await flush(); expect(provider.calls.unwrap).toBe(0);
    gate.resolve(undefined); expect(await result).toEqual({ value: document });
    expect(policy.assertAllowed).toHaveBeenCalledTimes(1);
  });

  it.each(['deny', 'reject', 'throw'] as const)('R02/R03 sanitizes %s and never unwraps', async kind => {
    const policy = { assertAllowed: () => {
      if (kind === 'throw') throw new Error(sensitiveSentinels.join('|'));
      return Promise.reject(kind === 'deny' ? new CryptoError('FORBIDDEN') : new Error(sensitiveSentinels.join('|')));
    } };
    const result = await observed(faultCipher(provider, policy).decrypt(await envelope(), context, grant));
    expect(result).toMatchObject({ error: { code: 'FORBIDDEN', message: 'FORBIDDEN' } });
    for (const s of sensitiveSentinels) expect(JSON.stringify(result)).not.toContain(s);
    expect(provider.calls.unwrap).toBe(0);
  });

  it.each(['resolve', 'reject', 'never'] as const)('R04/R05 ignores policy %s after timeout', async settlement => {
    const gate = deferred<void>(); let control: OperationControl | undefined;
    const result = observed(faultCipher(provider, { assertAllowed: (_g: unknown, _c: unknown, c: OperationControl) => {
      control = c; return gate.promise;
    } }).decrypt(await envelope(), context, grant));
    await vi.advanceTimersByTimeAsync(250);
    expect(await result).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(control?.signal.aborted).toBe(true);
    expect(control?.signal.reason).toMatchObject({ message: 'FORBIDDEN' });
    if (settlement === 'resolve') gate.resolve(undefined);
    if (settlement === 'reject') gate.reject(new Error('SYNTHETIC-LATE-SECRET'));
    await flush(); expect(provider.calls.unwrap).toBe(0);
  });

  it.each([undefined, true, 'allowed', Promise.resolve(true), { then: 1 }, { then() { throw new Error('SYNTHETIC'); } }])(
    'R07 rejects malformed policy return %#', async value => {
      await reject(faultCipher(provider, { assertAllowed: () => value }).decrypt(await envelope(), context, grant), 'FORBIDDEN');
      expect(provider.calls.unwrap).toBe(0);
    });

  it('R07 rejects a throwing then accessor', async () => {
    const value = Object.defineProperty({}, 'then', { get() { throw new Error('SYNTHETIC'); } });
    await reject(faultCipher(provider, { assertAllowed: () => value }).decrypt(await envelope(), context, grant), 'FORBIDDEN');
    expect(provider.calls.unwrap).toBe(0);
  });

  it.each(['create', 'unwrap'] as const)('R08 clears late %s keys and never retries timeout', async method => {
    const e = await envelope(), key = await provider.createAndWrapDataKey(context);
    const lateUnwrap = await provider.unwrapDataKey(e, context);
    const gate = deferred<unknown>(); let control: OperationControl | undefined;
    const invoke = vi.fn((...args: unknown[]) => { control = args.at(-1) as OperationControl; return gate.promise; });
    const p = { createAndWrapDataKey: invoke, unwrapDataKey: invoke };
    const cipher = faultCipher(p, new SyntheticAuthorizationPolicy(() => nowMs));
    const result = observed<unknown>(method === 'create' ? cipher.encrypt(document, context) : cipher.decrypt(e, context, grant));
    await vi.advanceTimersByTimeAsync(250);
    expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } });
    expect(control?.signal.aborted).toBe(true); expect(invoke).toHaveBeenCalledTimes(1);
    gate.resolve(method === 'create' ? key : lateUnwrap); await flush();
    expect((method === 'create' ? key.plaintextDek : lateUnwrap).every(b => b === 0)).toBe(true);
    await vi.advanceTimersByTimeAsync(2000); expect(invoke).toHaveBeenCalledTimes(1);
    key.plaintextDek.fill(0); lateUnwrap.fill(0);
  });

  it('R06/R09 retries only settled calls sequentially and authorizes once', async () => {
    const e = await envelope(), attempts = [deferred<Uint8Array>(), deferred<Uint8Array>(), deferred<Uint8Array>()];
    let active = 0, maximum = 0, count = 0;
    const unwrap = vi.fn(() => { active++; maximum = Math.max(maximum, active); return attempts[count++].promise.finally(() => { active--; }); });
    const policy = { assertAllowed: vi.fn(async () => {}) };
    const result = observed(faultCipher({ unwrapDataKey: unwrap }, policy).decrypt(e, context, grant));
    await flush(); expect(count).toBe(1);
    attempts[0].reject(new SyntheticProviderFailure('unavailable')); await flush();
    await vi.advanceTimersByTimeAsync(24); expect(count).toBe(1);
    await vi.advanceTimersByTimeAsync(1); expect(count).toBe(2);
    attempts[1].reject(new SyntheticProviderFailure('unavailable')); await flush();
    await vi.advanceTimersByTimeAsync(49); expect(count).toBe(2);
    await vi.advanceTimersByTimeAsync(1); expect(count).toBe(3);
    attempts[2].resolve(await provider.unwrapDataKey(e, context));
    expect(await result).toEqual({ value: document }); expect(maximum).toBe(1);
    expect(policy.assertAllowed).toHaveBeenCalledTimes(1);
  });

  it('R09 total deadline includes backoff and caps attempts', async () => {
    const invoke = vi.fn(async () => { throw new SyntheticProviderFailure('unavailable'); });
    const result = observed(faultCipher({ createAndWrapDataKey: invoke }, {}, {
      authorizationMs: 60, providerMs: 60, totalMs: 60, retryDelaysMs: [25, 50],
    }).encrypt(document, context));
    await vi.advanceTimersByTimeAsync(60);
    expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2, 3])('R09 bounds exhausted settled retries to %i', async max => {
    const invoke = vi.fn(async () => { throw new SyntheticProviderFailure('unavailable'); });
    const cipher = new PassengerDocumentCrypto({ createAndWrapDataKey: invoke, unwrapDataKey: invoke }, new SyntheticAuthorizationPolicy(), max);
    const result = observed(cipher.encrypt(document, context));
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } }); expect(invoke).toHaveBeenCalledTimes(max);
  });

  it.each(['denied', 'integrity', 'unknown', 'malformed'] as const)('R10 does not retry %s', async kind => {
    const invoke = vi.fn(async () => {
      if (kind === 'malformed') return { plaintextDek: Buffer.alloc(3) };
      if (kind === 'unknown') throw new Error(sensitiveSentinels.join('|'));
      throw new SyntheticProviderFailure(kind);
    });
    const result = await observed(faultCipher({ createAndWrapDataKey: invoke }, {}).encrypt(document, context));
    expect(result).toMatchObject({ error: { code: kind === 'denied' ? 'KEY_ACCESS_DENIED' : kind === 'integrity' ? 'INTEGRITY_FAILURE' : 'KEY_UNAVAILABLE' } });
    expect(invoke).toHaveBeenCalledTimes(1);
    for (const s of sensitiveSentinels) expect(JSON.stringify(result)).not.toContain(s);
  });

  it('R11/R12 observes late rejections and cooperative abort without leaking listeners or causes', async () => {
    const events: unknown[] = [], listener = (reason: unknown) => events.push(reason);
    const before = process.listenerCount('unhandledRejection'); process.on('unhandledRejection', listener);
    try {
      for (const cooperative of [false, true]) {
        const gate = deferred<WrappedDataKey>(); let acknowledgments = 0;
        const invoke = vi.fn((_c: unknown, control: OperationControl) => {
          if (cooperative) control.signal.addEventListener('abort', () => { acknowledgments++; gate.reject(new Error('SYNTHETIC-ABORT-SECRET')); }, { once: true });
          return gate.promise;
        });
        const result = observed(faultCipher({ createAndWrapDataKey: invoke }, {}).encrypt(document, context));
        await vi.advanceTimersByTimeAsync(250);
        expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE', message: 'KEY_UNAVAILABLE' } });
        if (!cooperative) gate.reject(new Error('SYNTHETIC-LATE-SECRET'));
        await flush(); expect(acknowledgments).toBe(cooperative ? 1 : 0); expect(invoke).toHaveBeenCalledTimes(1);
      }
      expect(events).toEqual([]);
    } finally { process.removeListener('unhandledRejection', listener); }
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });

  it('R13 logs no sensitive values during retry, timeout, late cleanup or success', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];
    const key = await provider.createAndWrapDataKey(context), late = deferred<WrappedDataKey>();
    let calls = 0;
    const result = observed(faultCipher({ createAndWrapDataKey: () => ++calls === 1 ? Promise.reject(new SyntheticProviderFailure('unavailable')) : late.promise }, {}).encrypt(document, context));
    await vi.advanceTimersByTimeAsync(275); expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } });
    late.resolve(key); await flush(); expect(key.plaintextDek.every(b => b === 0)).toBe(true);
    const e = await envelope(); expect(await crypto.decrypt(e, context, grant)).toEqual(document);
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });

  it('R14 snapshots envelope, grant and context before an authorization await', async () => {
    const e = { ...await envelope() }, c = { ...context }, g = { ...grant }, gate = deferred<void>();
    const result = observed(faultCipher(provider, { assertAllowed: () => gate.promise }).decrypt(e, c, g));
    e.tag = flip(e.tag); c.bookingId = 'synthetic-other'; g.expiresAtMs = 0;
    gate.resolve(undefined); expect(await result).toEqual({ value: document });
  });

  it.each(['authorization', 'backoff', 'provider'] as const)('R07 expiry during %s fails closed', async stage => {
    const e = await envelope(), gate = deferred<void>(), keyGate = deferred<Uint8Array>();
    let wall = nowMs, calls = 0;
    const key = await provider.unwrapDataKey(e, context);
    const cipher = faultCipher({ unwrapDataKey: () => {
      calls++; return stage === 'backoff' ? Promise.reject(new SyntheticProviderFailure('unavailable')) : keyGate.promise;
    } }, { assertAllowed: () => stage === 'authorization' ? gate.promise : Promise.resolve() }, { wallNow: () => wall });
    const result = observed(cipher.decrypt(e, context, grant)); await flush(); wall = grant.expiresAtMs;
    if (stage === 'authorization') gate.resolve(undefined);
    if (stage === 'provider') keyGate.resolve(key);
    if (stage === 'backoff') await vi.advanceTimersByTimeAsync(25);
    expect(await result).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(calls).toBe(stage === 'authorization' ? 0 : 1);
    if (stage === 'provider') expect(key.every(b => b === 0)).toBe(true);
    key.fill(0);
  });

  it.each([249, 250, 251])('R04 exact deadline and delayed timer settlement at %i', async tick => {
    let mono = 0; const gate = deferred<void>();
    const result = observed(faultCipher(provider, { assertAllowed: () => gate.promise }, { monotonicNow: () => mono }).decrypt(await envelope(), context, grant));
    mono = tick; gate.resolve(undefined);
    expect(await result).toMatchObject(tick < 250 ? { value: document } : { error: { code: 'FORBIDDEN' } });
    expect(provider.calls.unwrap).toBe(tick < 250 ? 1 : 0);
  });

  it('R08 winning key is usable before cleanup; repeated calls leave no timers', async () => {
    for (let i = 0; i < 5; i++) {
      const e = await envelope(); expect(await crypto.decrypt(e, context, grant)).toEqual(document);
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it.each([249, 250, 251])('R08 provider settlement at %i respects absolute deadline and key ownership', async tick => {
    const key = await provider.createAndWrapDataKey(context), gate = deferred<WrappedDataKey>(); let mono = 0;
    const cipher = faultCipher({ createAndWrapDataKey: () => gate.promise }, {}, { monotonicNow: () => mono });
    const result = observed(cipher.encrypt(document, context)); mono = tick; gate.resolve(key);
    const outcome = await result;
    if (tick < 250) {
      expect(outcome).toHaveProperty('value');
      if ('value' in outcome) expect(await crypto.decrypt(outcome.value, context, grant)).toEqual(document);
    } else expect(outcome).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } });
    expect(key.plaintextDek.every(b => b === 0)).toBe(true);
  });

  it('R04 limits authorization by total budget', async () => {
    const result = observed(faultCipher(provider, { assertAllowed: () => new Promise(() => {}) }, {
      authorizationMs: 50, providerMs: 50, totalMs: 50,
    }).decrypt(await envelope(), context, grant));
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toMatchObject({ error: { code: 'FORBIDDEN' } }); expect(provider.calls.unwrap).toBe(0);
  });

  it('R11 malformed late cleanup cannot create an unobserved rejection', async () => {
    const gate = deferred<unknown>();
    const result = observed(faultCipher({ createAndWrapDataKey: () => gate.promise }, {}).encrypt(document, context));
    await vi.advanceTimersByTimeAsync(250);
    expect(await result).toMatchObject({ error: { code: 'KEY_UNAVAILABLE' } });
    gate.resolve(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('SYNTHETIC-CLEANUP'); } }));
    await flush();
  });

  it.each([NaN, Infinity, -1])('rejects invalid runtime clock %s without provider use', tick => {
    return reject(faultCipher(provider, {}, { monotonicNow: () => tick }).encrypt(document, context), 'KEY_UNAVAILABLE')
      .then(() => expect(provider.calls.create).toBe(0));
  });

  it.each([NaN, Infinity, -1, 0, 0.5, 5001])('rejects invalid limits %s before any call', value => {
    for (const field of ['authorizationMs', 'providerMs', 'totalMs']) {
      expect(() => faultCipher(provider, {}, { [field]: value })).toThrow('INVALID_INPUT');
    }
    expect(provider.calls.create).toBe(0); expect(provider.calls.unwrap).toBe(0);
  });
  it('rejects stages above total and invalid retry delays', () => {
    expect(() => faultCipher(provider, {}, { totalMs: 100 })).toThrow('INVALID_INPUT');
    expect(() => faultCipher(provider, {}, { retryDelaysMs: [0, 50] })).toThrow('INVALID_INPUT');
  });
});
