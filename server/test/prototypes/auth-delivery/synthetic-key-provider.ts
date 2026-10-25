import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { FakeKeyFailure, type DeliveryContext, type KeyProvider, type WrappedDataKey, type WrappingMetadata, type OperationControl } from './contracts.js';
import { bytes, canonicalAAD, contextSnapshot, metadata } from './auth-delivery-codec.js';

/** Ephemeral independent auth-delivery KEKs, not a KMS emulator or production provider. */
export class SyntheticKeyProvider implements KeyProvider {
  private readonly keys = new Map<string, Buffer>([['v1',randomBytes(32)],['v2',randomBytes(32)]]);
  activeVersion: 'v1'|'v2'='v1';
  mode:'ok'|'denied'|'unavailable'='ok'; transientFailures=0;
  readonly calls={create:0,unwrap:0};
  private admit():void {
    if(this.mode==='denied')throw new FakeKeyFailure('denied');
    if(this.mode==='unavailable')throw new FakeKeyFailure('unavailable');
    if(this.transientFailures>0){this.transientFailures--;throw new FakeKeyFailure('unavailable');}
  }
  async createAndWrapDataKey(input:DeliveryContext,_control?:OperationControl):Promise<WrappedDataKey>{
    this.calls.create++;this.admit();const c=contextSnapshot(input),version=this.activeVersion,kek=this.keys.get(version);
    if(!kek)throw new FakeKeyFailure('unavailable');
    const plaintextDek=randomBytes(32),nonce=randomBytes(12);
    const m={keyProvider:'synthetic-auth-delivery',keyRef:'synthetic-auth-delivery-kek',keyVersion:version,wrapAlgorithm:'SYNTHETIC-A256GCM'} as const;
    try{
      const cipher=createCipheriv('aes-256-gcm',kek,nonce,{authTagLength:16});
      cipher.setAAD(Buffer.concat([Buffer.from('synthetic-auth-delivery-wrap-v1\0'),canonicalAAD(c,m)]));
      const encrypted=Buffer.concat([cipher.update(plaintextDek),cipher.final()]);
      return {...m,wrappedDek:Buffer.concat([nonce,encrypted,cipher.getAuthTag()]).toString('base64url'),plaintextDek};
    }catch{plaintextDek.fill(0);throw new FakeKeyFailure('integrity');}
  }
  async unwrapDataKey(input:WrappingMetadata,inputContext:DeliveryContext,_control?:OperationControl):Promise<Uint8Array>{
    this.calls.unwrap++;this.admit();let partial:Buffer|undefined;
    try{
      const m=metadata(input),c=contextSnapshot(inputContext),kek=this.keys.get(m.keyVersion);if(!kek)throw new FakeKeyFailure('unavailable');
      const wrapped=bytes(m.wrappedDek,60),cipher=createDecipheriv('aes-256-gcm',kek,wrapped.subarray(0,12),{authTagLength:16});
      cipher.setAAD(Buffer.concat([Buffer.from('synthetic-auth-delivery-wrap-v1\0'),canonicalAAD(c,m)]));cipher.setAuthTag(wrapped.subarray(44));
      partial=cipher.update(wrapped.subarray(12,44));return Buffer.concat([partial,cipher.final()]);
    }catch(e){if(e instanceof FakeKeyFailure)throw e;throw new FakeKeyFailure('integrity');}finally{partial?.fill(0);}
  }
  retire(version:'v1'|'v2'):void{this.keys.get(version)?.fill(0);this.keys.delete(version);}
  dispose():void{for(const k of this.keys.values())k.fill(0);this.keys.clear();}
}
