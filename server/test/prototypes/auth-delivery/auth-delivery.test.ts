import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { AuthDeliveryError, FakeKeyFailure, type DeliveryContext, type IssuanceReceipt, type KeyProvider, type Limits, type OperationControl, type Payload, type PersistentSnapshot, type WorkerPolicy, type WrappedDataKey } from './contracts.js';
import { AuthDeliveryCodec, SyntheticWorkerPolicy, bytes, canonicalAAD, parseEnvelope, payloadSnapshot } from './auth-delivery-codec.js';
import { SyntheticKeyProvider } from './synthetic-key-provider.js';
import { FakeOutbox, SimulatedCrash, classifyLegacy, type OutboxOptions } from './fake-outbox.js';
import { FakeTransport } from './fake-transport.js';
import { context, payload, grant, nowMs, request, token, deferred, observed, flush, offlineBoundary } from './fixtures.js';

let provider:SyntheticKeyProvider,codec:AuthDeliveryCodec,transport:FakeTransport,box:FakeOutbox,clock:{value:number};
beforeEach(()=>{
  expect(offlineBoundary.installed).toBe(true);vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
  clock={value:nowMs};provider=new SyntheticKeyProvider();transport=new FakeTransport();
  codec=new AuthDeliveryCodec(provider,new SyntheticWorkerPolicy(()=>clock.value),{wallNow:()=>clock.value});
  box=makeBox();
});
afterEach(()=>{expect(vi.getTimerCount()).toBe(0);provider.dispose();vi.restoreAllMocks();vi.useRealTimers();});
function makeBox(extra:Partial<OutboxOptions>={}){return new FakeOutbox({environmentId:context.environmentId,codec,transport,now:()=>clock.value,...extra});}
function runtimeCipher(p:unknown,policy:unknown,options:Limits={}){
  const value:unknown=Reflect.construct(AuthDeliveryCodec,[p,policy,{wallNow:()=>clock.value,...options}]);
  if(!(value instanceof AuthDeliveryCodec))throw new Error('SYNTHETIC_CONSTRUCTION');return value;
}
const denied=(p:Promise<unknown>,code:string)=>expect(p).rejects.toMatchObject({code});
const flip=(s:string)=>{const b=Buffer.from(s,'base64url');b[0]^=1;return b.toString('base64url');};
function row(receipt:IssuanceReceipt,b=box){const r=b.outboxSnapshot().find(r=>r.id===receipt.messageId);if(!r)throw new Error('SYNTHETIC_ROW');return r;}
// Explicitly model a persisted-state writer; exported live snapshots stay frozen.
function saved(b=box):PersistentSnapshot{return JSON.parse(JSON.stringify(b.snapshot()));}
function ctx(receipt:IssuanceReceipt):DeliveryContext{return {...context,messageId:receipt.messageId,tokenRecordId:receipt.tokenRecordId};}
function worker(receipt:IssuanceReceipt,workerId='synthetic-worker'){return {...grant,messageId:receipt.messageId,tokenRecordId:receipt.tokenRecordId,workerId,expiresAtMs:clock.value+3600000};}
function claim(receipt:IssuanceReceipt,b=box,workerId='synthetic-worker'){const l=b.claim(receipt.messageId,workerId);if(!l)throw new Error('SYNTHETIC_CLAIM');return l;}
async function secret(receipt:IssuanceReceipt,b=box){return (await codec.unprotect(row(receipt,b).envelope,ctx(receipt),worker(receipt))).token;}

if(false){
  // @ts-expect-error An unobserved synchronous policy cannot authorize a worker.
  const invalid:WorkerPolicy={assertAllowed:()=>{}};void invalid;
}

describe('T01 round trip and strict encoding',()=>{
  it.each(['EMAIL_VERIFY','PASSWORD_RESET'] as const)('round trips %s and serialized envelope',async purpose=>{
    const c={...context,purpose},p={...payload,purpose},g={...grant,purpose};const e=await codec.protect(p,c);
    const result=await codec.unprotect(JSON.stringify(e),c,g);expect(JSON.stringify(result)===JSON.stringify(p)).toBe(true);
    expect(e.nonce).not.toBe((await codec.protect(p,c)).nonce);expect(e.wrappedDek).not.toBe((await codec.protect(p,c)).wrappedDek);
  });
  it('uses the fixed canonical AAD bytes',()=>{
    const aad=canonicalAAD(context,{keyProvider:'synthetic-auth-delivery',keyRef:'synthetic-auth-delivery-kek',keyVersion:'v1',wrapAlgorithm:'SYNTHETIC-A256GCM'});
    expect(aad.toString()).toBe('["FlyWithSafe","flywithsafe.auth-delivery.v2","2","1","2","synthetic-offline","synthetic-message-1","synthetic-token-1","synthetic-user-1","EMAIL_VERIFY","synthetic-auth-delivery","synthetic-auth-delivery-kek","v1","SYNTHETIC-A256GCM"]');
  });
  it.each([
    {extra:true},{issuedAt:'2030-02-30T00:00:00.000Z'},{expiresAt:payload.issuedAt},{recipient:'real@example.com'},
    {recipient:'A@example.invalid'},{token:'not-synthetic'},{templateVersion:1},{token:'x'.repeat(5000)},
  ])('rejects malformed payload %# before provider',async change=>{
    await denied(codec.protect({...payload,...change},context),'INVALID_INPUT');expect(provider.calls.create).toBe(0);
  });
  it('rejects accessors and invalid envelope serialization without invoking getters',async()=>{
    let reads=0;const p=Object.defineProperty({...payload},'token',{get(){reads++;return token;},enumerable:true});
    await denied(codec.protect(p,context),'INVALID_INPUT');expect(reads).toBe(0);
    const e=await codec.protect(payload,context);expect(()=>parseEnvelope(' '+JSON.stringify(e))).toThrow('INVALID_ENVELOPE');
    expect(()=>parseEnvelope(JSON.stringify(e).replace('"envelopeVersion":2','"envelopeVersion":2,"envelopeVersion":2'))).toThrow('INVALID_ENVELOPE');
    expect(()=>bytes('AAA=')).toThrow();expect(()=>parseEnvelope('x'.repeat(17000))).toThrow();
  });
});

describe('T02 persisted secrecy',()=>{
  it('stores encrypted jobs and verification hashes only, with detached snapshots',async()=>{
    const receipt=await box.issue(request),credential=await secret(receipt),serialized=JSON.stringify(box.outboxSnapshot());
    for(const s of [credential,payload.recipient,'?token=','verificationUrl','resetUrl'])expect(serialized.includes(s)).toBe(false);
    expect(JSON.stringify(box.snapshot().tokens).includes(credential)).toBe(false);
    expect(transport.history()).toEqual([]);const snapshot=box.snapshot();expect(Object.isFrozen(snapshot.outbox[0].envelope)).toBe(true);expect(()=>{snapshot.outbox.length=0;}).toThrow();expect(box.outboxSnapshot().length).toBe(1);
  });
  it('does not send when encryption fails',async()=>{provider.mode='denied';await denied(box.issue(request),'FORBIDDEN');expect(box.snapshot().tokens.length+box.outboxSnapshot().length).toBe(0);expect(transport.history().length).toBe(0);});
});

describe('T03 ciphertext authentication',()=>{
  it.each(['ciphertext','tag','nonce','wrappedDek'] as const)('rejects changed %s',async field=>{
    const e=await codec.protect(payload,context);await denied(codec.unprotect({...e,[field]:flip(e[field])},context,grant),'INTEGRITY_FAILURE');
  });
  it.each(['truncate','append'] as const)('rejects %s ciphertext',async operation=>{
    const e=await codec.protect(payload,context),b=bytes(e.ciphertext);
    const changed=operation==='truncate'?b.subarray(0,-1):Buffer.concat([b,Buffer.alloc(1)]);
    await denied(codec.unprotect({...e,ciphertext:changed.toString('base64url')},context,grant),'INTEGRITY_FAILURE');
  });
  it('does not release invalid UTF-8 or noncanonical/extra decrypted fields',async()=>{
    for(const plain of [Buffer.from([0xff]),Buffer.from(JSON.stringify({...payload,extra:true})),Buffer.from(' '+JSON.stringify(payload))]){
      const wrapped=await provider.createAndWrapDataKey(context),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',wrapped.plaintextDek,nonce,{authTagLength:16});
      cipher.setAAD(canonicalAAD(context,wrapped));const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);wrapped.plaintextDek.fill(0);
      const {plaintextDek:_,...m}=wrapped;
      await denied(codec.unprotect({envelopeVersion:2,templateVersion:2,domain:'flywithsafe.auth-delivery.v2',algorithm:'AES-256-GCM',aadVersion:1,...m,nonce:nonce.toString('base64url'),ciphertext:encrypted.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')},context,grant),'INVALID_ENVELOPE');plain.fill(0);
    }
  });
});

describe('T04 binding and purpose separation',()=>{
  it.each(['environmentId','messageId','tokenRecordId','userId','purpose'] as const)('rejects transplanted %s',async field=>{
    const c={...context,[field]:field==='purpose'?'PASSWORD_RESET':'synthetic-other'},g={...grant,environmentId:c.environmentId,messageId:c.messageId,tokenRecordId:c.tokenRecordId,purpose:c.purpose};
    await denied(codec.unprotect(await codec.protect(payload,context),c,g),'INTEGRITY_FAILURE');
  });
  it.each([{keyProvider:'aws'},{keyRef:'https://synthetic.invalid'},{keyVersion:'v3'},{domain:'flywithsafe:google-oauth-state'},{envelopeVersion:1},{extra:true}])('rejects unknown metadata %# before unwrap',async change=>{
    const e=await codec.protect(payload,context);await expect(codec.unprotect({...e,...change},context,grant)).rejects.toBeInstanceOf(AuthDeliveryError);expect(provider.calls.unwrap).toBe(0);
  });
  it('rejects passenger and OAuth purposes without invoking their implementations',async()=>{
    await denied(codec.protect({...payload,purpose:'oauth:google:consume'},context),'INVALID_INPUT');
    await denied(codec.unprotect({payloadVersion:1,keyProvider:'synthetic',algorithm:'AES-256-GCM'},context,grant),'INVALID_ENVELOPE');expect(provider.calls.unwrap).toBe(0);
  });
});

describe('T05 recipient binding',()=>{
  it('rejects email change and change-away-and-back using identity revision',async()=>{
    const r=await box.issue(request);box.changeRecipient(context.userId,'other@example.invalid');box.changeRecipient(context.userId,payload.recipient);
    expect((await box.dispatch(claim(r),worker(r))).reasonCode).toBe('RECIPIENT_CHANGED');expect(transport.history().length).toBe(0);
  });
  it('rejects validly encrypted substitute recipient',async()=>{
    const r=await box.issue(request),p=await codec.unprotect(row(r).envelope,ctx(r),worker(r)),snapshot=saved();
    snapshot.outbox[0].envelope=await codec.protect({...p,recipient:'other@example.invalid'},ctx(r));const restored=makeBox({snapshot});
    expect((await restored.dispatch(claim(r,restored),worker(r))).reasonCode).toBe('RECIPIENT_CHANGED');expect(transport.history().length).toBe(0);
  });
  it('rejects an issuance recipient override',async()=>{await denied(Reflect.apply(box.issue,box,[{...request,recipient:'other@example.invalid'}]),'INVALID_INPUT');});
});

describe('T06 key failures and async orchestration',()=>{
  it('awaits authorization once, with zero early unwrap',async()=>{
    const e=await codec.protect(payload,context),gate=deferred<void>(),policy={assertAllowed:vi.fn(()=>gate.promise)};
    const result=observed(runtimeCipher(provider,policy).unprotect(e,context,grant));await flush();expect(provider.calls.unwrap).toBe(0);
    gate.resolve(undefined);expect('value' in await result).toBe(true);expect(policy.assertAllowed).toHaveBeenCalledTimes(1);
  });
  it.each(['denied','unavailable'] as const)('handles %s provider',async mode=>{
    provider.mode=mode;const result=observed(codec.protect(payload,context));await vi.advanceTimersByTimeAsync(75);
    expect(await result).toMatchObject({error:{code:mode==='denied'?'FORBIDDEN':'KEY_UNAVAILABLE'}});expect(provider.calls.create).toBe(mode==='denied'?1:3);
  });
  it('retries settled failures sequentially after 25 and 50 ms',async()=>{
    const e=await codec.protect(payload,context);provider.transientFailures=2;
    const policy={assertAllowed:vi.fn(async()=>{})},result=observed(runtimeCipher(provider,policy).unprotect(e,context,grant));
    await vi.advanceTimersByTimeAsync(24);expect(provider.calls.unwrap).toBe(1);
    await vi.advanceTimersByTimeAsync(1);expect(provider.calls.unwrap).toBe(2);
    await vi.advanceTimersByTimeAsync(49);expect(provider.calls.unwrap).toBe(2);
    await vi.advanceTimersByTimeAsync(1);expect('value' in await result).toBe(true);expect(policy.assertAllowed).toHaveBeenCalledTimes(1);
  });
  it.each(['create','unwrap'] as const)('times out %s without retry, scrubs late result',async mode=>{
    const e=await codec.protect(payload,context),wrapped=await provider.createAndWrapDataKey(context),unwrapped=await provider.unwrapDataKey(e,context),gate=deferred<unknown>();
    const invoke=vi.fn(()=>gate.promise),cipher=runtimeCipher({createAndWrapDataKey:invoke,unwrapDataKey:invoke},new SyntheticWorkerPolicy(()=>clock.value));
    const result=observed<unknown>(mode==='create'?cipher.protect(payload,context):cipher.unprotect(e,context,grant));await vi.advanceTimersByTimeAsync(250);
    expect(await result).toMatchObject({error:{code:'KEY_UNAVAILABLE'}});gate.resolve(mode==='create'?wrapped:unwrapped);await flush();
    expect((mode==='create'?wrapped.plaintextDek:unwrapped).every(b=>b===0)).toBe(true);expect(invoke).toHaveBeenCalledTimes(1);wrapped.plaintextDek.fill(0);unwrapped.fill(0);
  });
  it.each(['late-resolve','late-reject','bare-void','nonvoid','throw'] as const)('denies policy %s with zero unwrap',async mode=>{
    const e=await codec.protect(payload,context),gate=deferred<void>();
    const policy={assertAllowed:()=>{if(mode==='throw')throw new Error('SYNTHETIC_SECRET');if(mode==='bare-void')return undefined;if(mode==='nonvoid')return Promise.resolve(true);return gate.promise;}};
    const result=observed(runtimeCipher(provider,policy).unprotect(e,context,grant));
    if(mode.startsWith('late'))await vi.advanceTimersByTimeAsync(250);
    expect(await result).toMatchObject({error:{code:'FORBIDDEN'}});
    if(mode==='late-resolve')gate.resolve(undefined);if(mode==='late-reject')gate.reject(new Error('SYNTHETIC_SECRET'));await flush();expect(provider.calls.unwrap).toBe(0);
  });
  it.each([249,250,251])('enforces policy deadline with delayed timer at %i',async tick=>{
    const e=await codec.protect(payload,context),gate=deferred<void>();let mono=0;
    const result=observed(runtimeCipher(provider,{assertAllowed:()=>gate.promise},{monotonicNow:()=>mono}).unprotect(e,context,grant));mono=tick;gate.resolve(undefined);
    expect('value' in await result).toBe(tick<250);expect(provider.calls.unwrap).toBe(tick<250?1:0);
  });
  it('total budget includes retry delays',async()=>{
    const invoke=vi.fn(async()=>{throw new FakeKeyFailure('unavailable');});
    const result=observed(runtimeCipher({createAndWrapDataKey:invoke},{},{authorizationMs:60,providerMs:60,totalMs:60}).protect(payload,context));
    await vi.advanceTimersByTimeAsync(60);expect(await result).toMatchObject({error:{code:'KEY_UNAVAILABLE'}});expect(invoke).toHaveBeenCalledTimes(2);
  });
  it.each([NaN,Infinity,-1,0,0.5,5001,null])('rejects invalid limits %# before calls',value=>{
    expect(()=>Reflect.construct(AuthDeliveryCodec,[provider,{}, {authorizationMs:value}])).toThrow('INVALID_INPUT');expect(provider.calls.create).toBe(0);
  });
  it('malformed provider output fails closed and clears known key',async()=>{
    const key=Buffer.alloc(31,7),invoke=vi.fn(async()=>({plaintextDek:key}));
    await denied(runtimeCipher({createAndWrapDataKey:invoke},{}).protect(payload,context),'KEY_UNAVAILABLE');expect(key.every(b=>b===0)).toBe(true);expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('reads historical fake keys until explicit retirement',async()=>{
    const old=await codec.protect(payload,context);provider.activeVersion='v2';const current=await codec.protect(payload,context);
    expect((await codec.unprotect(old,context,grant)).token===token).toBe(true);provider.retire('v1');const result=observed(codec.unprotect(old,context,grant));await vi.advanceTimersByTimeAsync(75);
    expect(await result).toMatchObject({error:{code:'KEY_UNAVAILABLE'}});expect((await codec.unprotect(current,context,grant)).token===token).toBe(true);
  });
  it('freezes caller context, grant and envelope before asynchronous authorization',async()=>{
    const e={...await codec.protect(payload,context)},c={...context,messageId:String(context.messageId)},g={...grant},gate=deferred<void>();
    const result=observed(runtimeCipher(provider,{assertAllowed:()=>gate.promise}).unprotect(e,c,g));
    c.messageId='changed';g.expiresAtMs=0;e.tag=flip(e.tag);gate.resolve(undefined);
    const outcome=await result;expect('value' in outcome && outcome.value.token===token).toBe(true);
  });
  it.each([249,250,251])('provider result at %i obeys absolute deadline and clears DEK',async tick=>{
    const wrapped=await provider.createAndWrapDataKey(context),gate=deferred<WrappedDataKey>();let mono=0;
    const result=observed(runtimeCipher({createAndWrapDataKey:()=>gate.promise},{},{monotonicNow:()=>mono}).protect(payload,context));
    mono=tick;gate.resolve(wrapped);expect('value' in await result).toBe(tick<250);expect(wrapped.plaintextDek.every(b=>b===0)).toBe(true);
  });
  it('never overlaps pending attempts; only a settled classified failure permits another',async()=>{
    const first=deferred<WrappedDataKey>();let active=0,maximum=0,calls=0;
    const invoke=()=>{calls++;active++;maximum=Math.max(maximum,active);return (calls===1?first.promise:provider.createAndWrapDataKey(context)).finally(()=>{active--;});};
    const result=observed(runtimeCipher({createAndWrapDataKey:invoke},{}).protect(payload,context));await flush();
    await vi.advanceTimersByTimeAsync(100);expect(calls).toBe(1);first.reject(new FakeKeyFailure('unavailable'));await flush();
    await vi.advanceTimersByTimeAsync(25);expect('value' in await result).toBe(true);expect(maximum).toBe(1);expect(calls).toBe(2);
  });
  it.each(['integrity','unknown'] as const)('never retries settled %s failure',async kind=>{
    const invoke=vi.fn(async()=>{if(kind==='integrity')throw new FakeKeyFailure('integrity');throw new Error('SYNTHETIC_PROVIDER_SECRET');});
    await denied(runtimeCipher({createAndWrapDataKey:invoke},{}).protect(payload,context),kind==='integrity'?'INTEGRITY_FAILURE':'KEY_UNAVAILABLE');expect(invoke).toHaveBeenCalledTimes(1);
  });
  it.each([{role:'ADMIN'},{workerId:''},{environmentId:'other'},{messageId:'other'},{tokenRecordId:'other'},{purpose:'PASSWORD_RESET'},{expiresAtMs:nowMs},{extra:true}])('denies invalid worker grant %# before unwrap',async change=>{
    const e=await codec.protect(payload,context);await denied(codec.unprotect(e,context,{...grant,...change}),'FORBIDDEN');expect(provider.calls.unwrap).toBe(0);
  });
  it('sanitizes immediate policy rejection and throwing then accessor',async()=>{
    const e=await codec.protect(payload,context);
    for(const invoke of [()=>Promise.reject(new Error('SYNTHETIC_SECRET')),()=>Object.defineProperty({},'then',{get(){throw new Error('SYNTHETIC_SECRET');}})]){
      await denied(runtimeCipher(provider,{assertAllowed:invoke}).unprotect(e,context,grant),'FORBIDDEN');
    }expect(provider.calls.unwrap).toBe(0);
  });
});

describe('T07 atomic issuance and identity',()=>{
  it('commits account, token, job and registry; replays without more key calls',async()=>{
    const r=await box.issue(request),before=provider.calls.create,again=await box.issue(request);expect(again).toEqual(r);expect(provider.calls.create).toBe(before);
    const s=box.snapshot();expect([s.accounts.length,s.tokens.length,s.outbox.length,Object.keys(s.issuances).length]).toEqual([1,1,1,1]);
  });
  it('rejects same-key different payload',async()=>{await box.issue(request);await denied(box.issue({...request,expiresAtMs:request.expiresAtMs+1}),'ISSUANCE_CONFLICT');expect(box.snapshot().tokens.length).toBe(1);});
  it.each([true,false])('serializes concurrent issuance, same key=%s',async same=>{
    const results=await Promise.allSettled([box.issue(request),box.issue({...request,issuanceId:same?request.issuanceId:'second'})]);
    expect(results.filter(r=>r.status==='fulfilled').length).toBe(same?2:1);expect(box.snapshot().tokens.length).toBe(1);expect(box.outboxSnapshot().length).toBe(1);
  });
  it('supersedes old unconsumed credential only on deliberate new issuance',async()=>{
    const first=await box.issue(request);const {createAccount:_,...existing}=request;
    const second=await box.issue({...existing,issuanceId:'second',expectedAccountRevision:1,expectedPurposeRevision:1});expect(second.messageId).not.toBe(first.messageId);
    expect(box.snapshot().tokens.find(t=>t.id===first.tokenRecordId)?.revokedAtMs).toBe(nowMs);
  });
  it('same issuance key remains isolated across customers and purposes',async()=>{
    const first=await box.issue(request),other=await box.issue({...request,userId:'synthetic-other'});
    const {createAccount:_,...existing}=request;
    const reset=await box.issue({...existing,purpose:'PASSWORD_RESET',expectedAccountRevision:1});
    expect(new Set([first.messageId,other.messageId,reset.messageId]).size).toBe(3);expect(box.snapshot().tokens.length).toBe(3);
  });
  it('expired issuance replay returns only original receipt without renewed credential',async()=>{
    const first=await box.issue(request);clock.value=request.expiresAtMs;
    expect(await box.issue(request)).toEqual(first);expect(provider.calls.create).toBe(1);
    expect((await box.dispatch(claim(first),worker(first))).reasonCode).toBe('TOKEN_EXPIRED');
  });
});

describe('T08 unit-of-work rollback',()=>{
  it.each(['account','supersession','token','message','registry','publish'] as const)('rolls back failure at %s',async point=>{
    const failing=makeBox({fault:p=>{if(p===point)throw new Error('SYNTHETIC_FAILURE');}});
    await denied(failing.issue(request),'TRANSPORT_TERMINAL');const s=failing.snapshot();expect(s.accounts.length+s.tokens.length+s.outbox.length+Object.keys(s.issuances).length).toBe(0);expect(transport.history().length).toBe(0);
  });
  it('failed replacement preserves existing valid token',async()=>{
    const first=await box.issue(request),snapshot=box.snapshot(),failing=makeBox({snapshot,fault:p=>{if(p==='publish')throw new Error();}}),{createAccount:_,...existing}=request;
    await denied(failing.issue({...existing,issuanceId:'second',expectedAccountRevision:1,expectedPurposeRevision:1}),'TRANSPORT_TERMINAL');
    expect(failing.snapshot().tokens.find(t=>t.id===first.tokenRecordId)?.revokedAtMs).toBe(null);expect(failing.snapshot().tokens.length).toBe(1);
  });
  it('expiry during out-of-transaction encryption prevents any commit',async()=>{
    const gate=deferred<void>(),delayed={protect:async(p:unknown,c:unknown)=>{await gate.promise;return codec.protect(p,c);},unprotect:codec.unprotect.bind(codec)};
    box=makeBox({codec:delayed});const result=observed(box.issue(request));clock.value=request.expiresAtMs;gate.resolve(undefined);
    expect(await result).toMatchObject({error:{code:'TOKEN_EXPIRED'}});expect(box.snapshot().tokens.length+box.snapshot().accounts.length+box.outboxSnapshot().length).toBe(0);
  });
});

describe('T09 modeled restart persistence',()=>{
  it('recovers original receipt and protected job from snapshot with same fake keys',async()=>{
    const r=await box.issue(request),restored=makeBox({snapshot:box.snapshot()}),calls=provider.calls.create;
    expect(await restored.issue(request)).toEqual(r);expect(provider.calls.create).toBe(calls);
    expect((await restored.dispatch(claim(r,restored),worker(r))).status).toBe('DELIVERED');
  });
});

describe('T10 stable retry',()=>{
  it('keeps original ciphertext, token count and identity across delivery retries',async()=>{
    const r=await box.issue(request),original=JSON.stringify(row(r).envelope);transport.outcomes=['transientFailure','submitted'];
    expect((await box.dispatch(claim(r),worker(r))).status).toBe('PENDING');expect(box.claim(r.messageId,'synthetic-worker')).toBe(null);
    clock.value+=60000;expect((await box.dispatch(claim(r),worker(r))).status).toBe('DELIVERED');
    expect(JSON.stringify(row(r).envelope)===original).toBe(true);expect(box.snapshot().tokens.length).toBe(1);expect(provider.calls.create).toBe(1);
  });
});

describe('T11 credential and grant validity',()=>{
  it.each(['expired','consumed','revoked','missing'] as const)('rejects %s before send',async condition=>{
    const r=await box.issue(request);if(condition==='expired')clock.value=request.expiresAtMs;if(condition==='revoked')box.revoke(r.tokenRecordId);
    if(condition==='consumed')expect(box.consume(await secret(r),request.purpose,'VERIFY_EMAIL')).toBe(true);
    if(condition==='missing'){const s=saved();s.tokens.splice(0);box=makeBox({snapshot:s});}
    const result=await box.dispatch(claim(r),worker(r));expect(result.status).toBe('FAILED');expect(transport.history().length).toBe(0);
  });
  it.each(['policy','provider','backoff'] as const)('rejects expiry during %s',async stage=>{
    const e=await codec.protect(payload,context),auth=deferred<void>(),key=deferred<Uint8Array>();let calls=0;
    const realKey=await provider.unwrapDataKey(e,context);
    const cipher=runtimeCipher({unwrapDataKey:()=>{calls++;return stage==='backoff'?Promise.reject(new FakeKeyFailure('unavailable')):key.promise;}},{assertAllowed:()=>stage==='policy'?auth.promise:Promise.resolve()});
    const result=observed(cipher.unprotect(e,context,grant));await flush();clock.value=grant.expiresAtMs;
    if(stage==='policy')auth.resolve(undefined);if(stage==='provider')key.resolve(realKey);if(stage==='backoff')await vi.advanceTimersByTimeAsync(25);
    expect(await result).toMatchObject({error:{code:'FORBIDDEN'}});expect(calls).toBe(stage==='policy'?0:1);
    if(stage==='provider')expect(realKey.every(b=>b===0)).toBe(true);realKey.fill(0);
  });
  it('rechecks credential immediately before send after async decrypt',async()=>{
    const gate=deferred<void>(),delayed=new AuthDeliveryCodec(provider,{assertAllowed:()=>gate.promise},{wallNow:()=>clock.value});box=makeBox({codec:delayed});
    const r=await box.issue(request),result=box.dispatch(claim(r),worker(r));await flush();box.revoke(r.tokenRecordId);gate.resolve(undefined);
    expect((await result).reasonCode).toBe('TOKEN_REVOKED');expect(transport.history().length).toBe(0);
  });
  it('rejects expired grant and validly encrypted but wrong credential',async()=>{
    const r=await box.issue(request);expect((await box.dispatch(claim(r),{...worker(r),expiresAtMs:clock.value})).reasonCode).toBe('FORBIDDEN');expect(provider.calls.unwrap).toBe(0);
    const s=saved(),p=await codec.unprotect(s.outbox[0].envelope,ctx(r),worker(r));
    s.outbox[0].envelope=await codec.protect({...p,token},ctx(r));s.outbox[0].status='PENDING';s.outbox[0].reasonCode=null;box=makeBox({snapshot:s});
    expect((await box.dispatch(claim(r),worker(r))).reasonCode).toBe('TOKEN_INVALID');expect(transport.history().length).toBe(0);
  });
});

describe('T12 conditional consumption',()=>{
  it.each(['EMAIL_VERIFY','PASSWORD_RESET'] as const)('permits only one concurrent modeled %s redemption',async p=>{
    const r=await box.issue({...request,purpose:p}),c={...ctx(r),purpose:p},g={...worker(r),purpose:p};const credential=(await codec.unprotect(row(r).envelope,c,g)).token;
    const effect=p==='EMAIL_VERIFY'?'VERIFY_EMAIL':'RESET_PASSWORD';const outcomes=await Promise.all([Promise.resolve().then(()=>box.consume(credential,p,effect)),Promise.resolve().then(()=>box.consume(credential,p,effect))]);
    expect(outcomes.filter(Boolean).length).toBe(1);const a=box.snapshot().accounts[0];expect(p==='EMAIL_VERIFY'?a.emailVerified:a.passwordEffects===1&&a.sessionEffects===1).toBe(true);
  });
  it('wrong-purpose/invalid redemption fails, effect fault rolls back consumption',async()=>{
    const r=await box.issue(request),credential=await secret(r),failing=makeBox({snapshot:box.snapshot(),fault:p=>{if(p==='effect')throw new Error();}});
    expect(failing.consume(credential,'PASSWORD_RESET','RESET_PASSWORD')).toBe(false);expect(failing.consume('SYNTHETIC_INVALID',request.purpose,'VERIFY_EMAIL')).toBe(false);
    expect(()=>failing.consume(credential,request.purpose,'VERIFY_EMAIL')).toThrow('TRANSPORT_TERMINAL');expect(failing.snapshot().tokens[0].consumedAtMs).toBe(null);expect(failing.snapshot().accounts[0].emailVerified).toBe(false);
  });
});

describe('T13 lease fencing',()=>{
  it('one claimant, expiry recovery, stale and late acknowledgment blocked',async()=>{
    const r=await box.issue(request),first=claim(r);expect(box.claim(r.messageId,'other')).toBe(null);clock.value=first.expiresAtMs;
    expect(box.acknowledge(first,'DELIVERED')).toBe(false);const next=claim(r,box,'other');expect(next.version).toBeGreaterThan(first.version);
    expect(box.acknowledge(first,'FAILED')).toBe(false);expect((await box.dispatch(next,worker(r,'other'))).status).toBe('DELIVERED');
  });
  it('lost lease during decrypt cannot send or alter new owner',async()=>{
    const gate=deferred<void>(),delayed=new AuthDeliveryCodec(provider,{assertAllowed:()=>gate.promise},{wallNow:()=>clock.value});box=makeBox({codec:delayed});
    const r=await box.issue(request),first=claim(r),pending=box.dispatch(first,worker(r));await flush();clock.value=first.expiresAtMs;const next=claim(r,box,'other');gate.resolve(undefined);
    await pending;expect(row(r).version).toBe(next.version);expect(row(r).leaseOwnerId).toBe('other');expect(transport.history().length).toBe(0);
  });
  it('equal ticks still advance versions and backward ticks fail closed',async()=>{
    const r=await box.issue(request),l=claim(r);expect(box.acknowledge(l,'FAILED','DELIVERY_DISABLED')).toBe(true);const version=row(r).version;
    expect(box.redrive(r.messageId,version)).toBe(true);expect(row(r).version).toBeGreaterThan(version);clock.value--;expect(()=>box.claim(r.messageId,'other')).toThrow('FORBIDDEN');
  });
  it('validly authorized wrong worker cannot send',async()=>{const r=await box.issue(request);expect((await box.dispatch(claim(r),worker(r,'other'))).reasonCode).toBe('FORBIDDEN');expect(transport.history().length).toBe(0);});
});

describe('T14 delivery truthfulness',()=>{
  it.each(['suppressed','terminalFailure','submitted'] as const)('classifies %s',async outcome=>{
    const r=await box.issue(request);transport.outcomes=[outcome];const result=await box.dispatch(claim(r),worker(r));expect(result.status).toBe(outcome==='submitted'?'DELIVERED':'FAILED');
  });
  it('disabled delivery never submits and can redrive only when valid',async()=>{
    const r=await box.issue(request);transport.enabled=false;expect((await box.dispatch(claim(r),worker(r))).reasonCode).toBe('DELIVERY_DISABLED');
    expect(box.redrive(r.messageId,row(r).version)).toBe(true);transport.enabled=true;expect((await box.dispatch(claim(r),worker(r))).status).toBe('DELIVERED');
  });
  it('bounded maximum attempts and exponential schedule',async()=>{
    const r=await box.issue(request);transport.outcomes=Array(5).fill('transientFailure');
    for(let i=1;i<=5;i++){const result=await box.dispatch(claim(r),worker(r));expect(row(r).attempts).toBe(i);expect(result.status).toBe(i===5?'FAILED':'PENDING');clock.value=row(r).nextAttemptAtMs;}
    expect(box.claim(r.messageId,'synthetic-worker')).toBe(null);expect(transport.history().length).toBe(5);
  });
  it('unknown transport outcome is sanitized and terminal',async()=>{
    const r=await box.issue(request);Reflect.set(transport,'outcomes',['SYNTHETIC_UNSAFE_REASON']);
    expect((await box.dispatch(claim(r),worker(r))).reasonCode).toBe('TRANSPORT_TERMINAL');expect(JSON.stringify(transport.history()).includes('SYNTHETIC_UNSAFE_REASON')).toBe(false);
  });
});

describe('T15 redrive constraints',()=>{
  it.each(['expired','consumed','revoked','recipient'] as const)('cannot redrive %s',async condition=>{
    const r=await box.issue(request),credential=await secret(r);transport.enabled=false;await box.dispatch(claim(r),worker(r));
    if(condition==='expired')clock.value=request.expiresAtMs;if(condition==='consumed')box.consume(credential,request.purpose,'VERIFY_EMAIL');if(condition==='revoked')box.revoke(r.tokenRecordId);if(condition==='recipient')box.changeRecipient(request.userId,'other@example.invalid');
    expect(box.redrive(r.messageId,row(r).version)).toBe(false);expect(box.snapshot().tokens.length).toBe(1);
  });
  it('rejects stale redrive and forbidden/integrity reasons',async()=>{
    const r=await box.issue(request);transport.enabled=false;await box.dispatch(claim(r),worker(r));expect(box.redrive(r.messageId,row(r).version-1)).toBe(false);
    const s=saved();s.outbox[0].reasonCode='INTEGRITY_FAILURE';const restored=makeBox({snapshot:s});expect(restored.redrive(r.messageId,row(r,restored).version)).toBe(false);
  });
  it('key recovery permits controlled redrive of the original envelope',async()=>{
    box=makeBox({maxAttempts:1});const r=await box.issue(request),original=JSON.stringify(row(r).envelope);provider.mode='unavailable';
    const result=box.dispatch(claim(r),worker(r));await vi.advanceTimersByTimeAsync(75);expect((await result).reasonCode).toBe('KEY_UNAVAILABLE');expect(row(r).status).toBe('FAILED');
    provider.mode='ok';expect(box.redrive(r.messageId,row(r).version)).toBe(true);expect((await box.dispatch(claim(r),worker(r))).status).toBe('DELIVERED');
    expect(JSON.stringify(row(r).envelope)===original).toBe(true);expect(provider.calls.create).toBe(1);
  });
});

describe('T16 acceptance ambiguity',()=>{
  it('accepted transport then crash can duplicate on recovery with the same token',async()=>{
    let crash=true;box=makeBox({fault:p=>{if(p==='afterSubmit'&&crash){crash=false;throw new SimulatedCrash();}}});
    const r=await box.issue(request),first=claim(r);await box.dispatch(first,worker(r));expect(row(r).status).toBe('PROCESSING');expect(transport.history().length).toBe(1);
    clock.value=first.expiresAtMs;const next=claim(r);await box.dispatch(next,worker(r));expect(row(r).status).toBe('DELIVERED');expect(transport.history().length).toBe(2);
    expect(box.snapshot().tokens.length).toBe(1);expect(provider.calls.create).toBe(1);expect(box.acknowledge(first,'FAILED')).toBe(false);
  });
  it('settled ambiguity can retry but an in-flight send is never raced',async()=>{
    const r=await box.issue(request),gate=deferred<void>();transport.beforeSubmit=()=>gate.promise;
    const lease=claim(r),pending=box.dispatch(lease,worker(r));await flush();clock.value=lease.expiresAtMs;const next=claim(r,box,'other');gate.resolve(undefined);await pending;
    expect(row(r).version).toBe(next.version);expect(row(r).status).toBe('PROCESSING');expect(transport.history().length).toBe(1);
    transport.beforeSubmit=undefined;transport.outcomes=['ambiguous'];expect((await box.dispatch(next,worker(r,'other'))).reasonCode).toBe('TRANSPORT_AMBIGUOUS');
  });
});

describe('T17 logging and sanitized failures',()=>{
  it('emits no credential/recipient/key material in diagnostics, errors or transport history',async()=>{
    const spies=[vi.spyOn(console,'log'),vi.spyOn(console,'error'),vi.spyOn(console,'warn'),vi.spyOn(console,'info'),vi.spyOn(console,'debug')];
    const r=await box.issue(request),credential=await secret(r);transport.outcomes=['transientFailure','submitted'];await box.dispatch(claim(r),worker(r));clock.value+=60000;await box.dispatch(claim(r),worker(r));
    const failure=await observed(runtimeCipher({createAndWrapDataKey:async()=>{throw new Error(credential);}},{}).protect(payload,context));
    for(const s of [credential,payload.recipient,token]){expect(JSON.stringify(failure).includes(s)).toBe(false);expect(JSON.stringify(transport.history()).includes(s)).toBe(false);expect(JSON.stringify(box.outboxSnapshot()).includes(s)).toBe(false);}
    spies.forEach(s=>expect(s).not.toHaveBeenCalled());
  });
  it('observes late rejection and clears cooperative abort listeners',async()=>{
    const errors:unknown[]=[],listener=(e:unknown)=>errors.push(e);const before=process.listenerCount('unhandledRejection');process.on('unhandledRejection',listener);
    try{
      const gate=deferred<WrappedDataKey>();let aborted=0;
      const result=observed(runtimeCipher({createAndWrapDataKey:(_c:unknown,control:OperationControl)=>{
        control.signal.addEventListener('abort',()=>{aborted++;gate.reject(new Error('SYNTHETIC_LATE'));},{once:true});return gate.promise;
      }},{}).protect(payload,context));await vi.advanceTimersByTimeAsync(250);expect(await result).toMatchObject({error:{code:'KEY_UNAVAILABLE'}});await flush();expect(aborted).toBe(1);expect(errors.length).toBe(0);
    }finally{process.removeListener('unhandledRejection',listener);}expect(process.listenerCount('unhandledRejection')).toBe(before);
  });
  it('normalizes malformed error codes and strips mutated provider error details',async()=>{
    const malformed:unknown=Reflect.construct(AuthDeliveryError,['SYNTHETIC_UNSAFE_REASON']);
    expect(malformed).toMatchObject({code:'KEY_UNAVAILABLE',message:'KEY_UNAVAILABLE'});
    const error=new AuthDeliveryError('KEY_UNAVAILABLE');error.message='SYNTHETIC_UNSAFE_REASON';Reflect.set(error,'cause',token);
    const result=await observed(runtimeCipher({createAndWrapDataKey:async()=>{throw error;}},{}).protect(payload,context));
    expect(JSON.stringify(result).includes(token)).toBe(false);expect(result).toMatchObject({error:{message:'KEY_UNAVAILABLE'}});
  });
  it('sanitizes raw exceptions from fake encryption and transport fault hooks',async()=>{
    const badCodec={protect:async()=>{throw new Error(token);},unprotect:codec.unprotect.bind(codec)};
    const failed=await observed(makeBox({codec:badCodec}).issue(request));expect(JSON.stringify(failed).includes(token)).toBe(false);
    transport.beforeSubmit=async()=>{throw new Error(token);};
    const result=await observed(transport.submit({messageId:context.messageId,recipient:payload.recipient,token,purpose:context.purpose}));
    expect(result).toMatchObject({error:{code:'TRANSPORT_TERMINAL'}});expect(JSON.stringify(result).includes(token)).toBe(false);
  });
});

describe('T18 versioned compatibility',()=>{
  it('quarantines V1; recognizes V2 without treating V1 as a sendable payload',async()=>{
    expect(classifyLegacy({template:'EMAIL_VERIFICATION',params:{}})).toBe('LEGACY_REQUIRES_REVIEW');expect(classifyLegacy(await codec.protect(payload,context))).toBe('V2');
    expect(()=>classifyLegacy({envelopeVersion:9,template:'EMAIL_VERIFICATION',params:{}})).toThrow();
  });
  it('writer-off capability keeps a reader for protected jobs, no plaintext fallback',async()=>{
    const r=await box.issue(request),readerOnly={protect:async()=>{throw new AuthDeliveryError('FORBIDDEN');},unprotect:codec.unprotect.bind(codec)};
    const restored=makeBox({codec:readerOnly,snapshot:box.snapshot()});expect((await restored.dispatch(claim(r,restored),worker(r))).status).toBe('DELIVERED');
    const {createAccount:_,...existing}=request;await denied(restored.issue({...existing,issuanceId:'later',expectedAccountRevision:1,expectedPurposeRevision:1}),'FORBIDDEN');expect(restored.snapshot().tokens.length).toBe(1);
  });
  it('corrupt/mixed V2 never enters a legacy fallback',async()=>{const e=await codec.protect(payload,context);expect(()=>classifyLegacy({...e,params:{}})).toThrow('INVALID_ENVELOPE');await denied(codec.unprotect({...e,tag:flip(e.tag)},context,grant),'INTEGRITY_FAILURE');});
  it('restored snapshots reject unknown persistent fields and unapproved reason strings',async()=>{
    const r=await box.issue(request);
    const s=saved();Reflect.set(s.outbox[0],'token','SYNTHETIC_UNSAFE_FIELD');expect(()=>makeBox({snapshot:s})).toThrow('INVALID_INPUT');
    const clean=saved();Reflect.set(clean.outbox[0],'reasonCode','SYNTHETIC_UNSAFE_REASON');expect(()=>makeBox({snapshot:clean})).toThrow('INVALID_INPUT');
    const lease=claim(r);expect(Reflect.apply(box.acknowledge,box,[lease,'FAILED','SYNTHETIC_UNSAFE_REASON'])).toBe(false);expect(row(r).status).toBe('PROCESSING');
  });
});
