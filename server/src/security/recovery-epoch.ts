import { randomBytes, verify, type KeyObject } from 'node:crypto';
import { types } from 'node:util';
import type { RecoveryAdmission } from './issuance-replay.js';

export interface EpochAuthority {
  /** Must be outside the restored DB; signs a fresh challenge using the separately managed authority. */
  attest(nonce:string,action:'issue'|'consume'|'deliver',signal:AbortSignal):Promise<{statement:string;signature:string}>;
}
/** No default identity/key/epoch/authority, no caching, no retry, and no self-certification by restored rows. */
export class SignedRecoveryAdmission implements RecoveryAdmission {
  private readonly key:KeyObject;
  private readonly scope:string;
  private readonly epoch:string;
  private readonly authority:EpochAuthority;
  constructor(input:{publicKey:KeyObject;scope:string;epoch:string;authority:EpochAuthority}){
    if(input.publicKey.type!=='public'||input.publicKey.asymmetricKeyType!=='ed25519'||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.scope)||! /^[A-Za-z0-9_-]{16,128}$/.test(input.epoch)||
      typeof input.authority?.attest!=='function')throw new Error('RECOVERY_ADMISSION_CONFIGURATION_INVALID');
    this.key=input.publicKey;this.scope=input.scope;this.epoch=input.epoch;this.authority=input.authority;
  }
  async admit(action:'issue'|'consume'|'deliver'):Promise<boolean>{
    if(!['issue','consume','deliver'].includes(action))return false;
    const nonce=randomBytes(24).toString('base64url'),controller=new AbortController(),deadline=performance.now()+250;
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const result:unknown=await Promise.race([
        Promise.resolve().then(()=>{if(controller.signal.aborted||performance.now()>=deadline)throw new Error();return this.authority.attest(nonce,action,controller.signal);}),
        new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error());},250);}),
      ]);
      if(performance.now()>=deadline||!result||typeof result!=='object'||types.isProxy(result)||
        Object.getOwnPropertySymbols(result).length||Object.getOwnPropertyNames(result).sort().join(',')!=='signature,statement')return false;
      const statement=Object.getOwnPropertyDescriptor(result,'statement'),signature=Object.getOwnPropertyDescriptor(result,'signature');
      if(!statement||!('value'in statement)||!signature||!('value'in signature)||typeof statement.value!=='string'||
        Buffer.byteLength(statement.value)>1024||typeof signature.value!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature.value))return false;
      const sig=Buffer.from(signature.value,'base64url');
      if(sig.length!==64||sig.toString('base64url')!==signature.value||!verify(null,Buffer.from(statement.value),this.key,sig))return false;
      const value:unknown=JSON.parse(statement.value);
      if(!Array.isArray(value)||value.length!==9||JSON.stringify(value)!==statement.value)return false;
      const [domain,version,scope,epoch,challenge,operation,ready,issuedAt,expiresAt]=value;
      const now=Date.now();
      return domain==='fws-recovery-epoch'&&version===1&&scope===this.scope&&epoch===this.epoch&&challenge===nonce&&operation===action&&ready===true&&
        Number.isSafeInteger(issuedAt)&&Number.isSafeInteger(expiresAt)&&issuedAt<=now&&expiresAt>now&&expiresAt-issuedAt<=2000&&performance.now()<deadline;
    }catch{return false;}
    finally{clearTimeout(timer);controller.abort();}
  }
}
