import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { context, document, grant, nowMs, sensitiveSentinels } from './fixtures.js';
import { offlineBoundary } from './vitest.config.js';
import { CryptoError, type CryptoEnvelopeV1, type DataKeyProvider, type WrappedDataKey } from './contracts.js';
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
afterEach(() => { provider.dispose(); vi.restoreAllMocks(); });
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
  it('stops after three creation attempts', async () => {
    provider.mode = 'unavailable'; await reject(envelope(), 'KEY_UNAVAILABLE'); expect(provider.calls.create).toBe(3);
  });
  it('stops after three unwrap attempts', async () => {
    const e = await envelope(); provider.mode = 'unavailable';
    await reject(crypto.decrypt(e, context, grant), 'KEY_UNAVAILABLE'); expect(provider.calls.unwrap).toBe(3);
  });
  it('recovers within bounded attempts', async () => {
    provider.transientFailures = 2; const e = await envelope(); expect(provider.calls.create).toBe(3);
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
  it('keeps old envelopes readable until the needed fake key is retired', async () => {
    const old = await envelope(); provider.activeVersion = 'v2'; const current = await envelope();
    expect(current.keyVersion).toBe('v2'); expect(await crypto.decrypt(old, context, grant)).toEqual(document);
    provider.retire('v1'); await reject(crypto.decrypt(old, context, grant), 'KEY_UNAVAILABLE');
    expect(await crypto.decrypt(current, context, grant)).toEqual(document);
  });
});

describe('17 rollback limitation', () => {
  it('accepts an older valid same-context envelope, requiring independent revision/CAS', async () => {
    const old = await envelope(); await crypto.encrypt({ passportNumber: 'SYNTHETIC-REPLACEMENT' }, context);
    expect(await crypto.decrypt(old, context, grant)).toEqual(document);
  });
});
