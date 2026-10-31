import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { snapshotLogicalInput } from './logical-digest.js';
import { inquiryDigest, matchesInquiryDigest, type LogicalDigestPolicy } from './idempotency-digest.js';
import type { AuthTransaction } from './protected-auth.js';

export type IssuanceOperation = 'register'|'verification'|'reset';
export interface IssuanceReceipt {
  operation: IssuanceOperation; userId: string|null; credentialId: string|null; jobId: string|null; sessionId: string|null;
}
export interface IssuanceRecord { fingerprint:string; receipt:IssuanceReceipt }
export interface IssuanceTransaction extends AuthTransaction {
  reserveRequest(keyHash:string,fingerprint:string):Promise<{created:boolean;record:IssuanceRecord|null}>;
  completeRequest(keyHash:string,receipt:IssuanceReceipt):Promise<void>;
}
export interface IssuanceStore {
  lookupRequest(keyHash:string):Promise<IssuanceRecord|null>;
  issuanceTransaction<T>(work:(tx:IssuanceTransaction)=>Promise<T>):Promise<T>;
}
export interface RecoveryAdmission {
  /** Real composition must validate a current epoch outside the restored DB snapshot. No default allow. */
  admit(action:'issue'|'consume'|'deliver'):Promise<boolean>;
}
export type RequestResult<T>={replayed:true;receipt:IssuanceReceipt}|{replayed:false;receipt:IssuanceReceipt;value:T};
export interface PreparedRequest<T> {receipt:IssuanceReceipt;value:T;apply(tx:AuthTransaction):Promise<void>}
const scope={operation:'auth:issuance-request',principal:'auth-request'};
const conflicts=new WeakSet<object>();
export class IssuanceRequestConflict extends Error {
  constructor(){super('ISSUANCE_REQUEST_CONFLICT');conflicts.add(this);}
}
export function isIssuanceRequestConflict(error:unknown):boolean {
  return !!error&&typeof error==='object'&&conflicts.has(error);
}
function validateReceipt(receipt:IssuanceReceipt,operation:IssuanceOperation):void {
  if(!receipt||typeof receipt!=='object'||types.isProxy(receipt)||Object.getOwnPropertySymbols(receipt).length||
    Object.getPrototypeOf(receipt)!==Object.prototype&&Object.getPrototypeOf(receipt)!==null||
    Object.getOwnPropertyNames(receipt).sort().join(',')!=='credentialId,jobId,operation,sessionId,userId')throw new Error('ISSUANCE_RECEIPT_INVALID');
  for(const key of Object.getOwnPropertyNames(receipt)){const d=Object.getOwnPropertyDescriptor(receipt,key);if(!d||!('value'in d))throw new Error('ISSUANCE_RECEIPT_INVALID');}
  const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
  if(receipt.operation!==operation || operation==='register'&&receipt.userId===null || (receipt.userId===null
    ? receipt.credentialId!==null||receipt.jobId!==null||receipt.sessionId!==null
    : !id(receipt.userId)||!id(receipt.credentialId)||!id(receipt.jobId)||
      (operation==='register'?!id(receipt.sessionId):receipt.sessionId!==null)))throw new Error('ISSUANCE_RECEIPT_INVALID');
}
/** Fast replay avoids fresh token/hash/encryption; a race loser discards prepared work, never applies it. */
export async function executeIssuanceRequest<T>(store:IssuanceStore,policy:LogicalDigestPolicy,recovery:RecoveryAdmission,
  requestId:string,operation:IssuanceOperation,logicalInput:unknown,prepare:()=>Promise<PreparedRequest<T>>):Promise<RequestResult<T>> {
  const failed=()=>new Error('ISSUANCE_REQUEST_FAILED');
  try {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)||
      !['register','verification','reset'].includes(operation))throw failed();
    const input=snapshotLogicalInput({operation,input:logicalInput});
    if(await recovery.admit('issue')!==true)throw failed();
    const keyHash=createHash('sha256').update(requestId.toLowerCase()).digest('hex');
    const replay=(record:IssuanceRecord):RequestResult<T>=>{
      if(!record.fingerprint.startsWith('h1:'))throw failed();
      if(!matchesInquiryDigest(record.fingerprint,input,scope,policy))throw new IssuanceRequestConflict();
      validateReceipt(record.receipt,operation);return {replayed:true,receipt:{...record.receipt}};
    };
    const existing=await store.lookupRequest(keyHash);if(existing)return replay(existing);
    const fingerprint=inquiryDigest(input,scope,policy);
    // All credential generation, hashing and encryption finish before opening the DB transaction.
    const prepared=await prepare();validateReceipt(prepared.receipt,operation);
    if(await recovery.admit('issue')!==true)throw failed();
    return await store.issuanceTransaction(async tx=>{
      const reservation=await tx.reserveRequest(keyHash,fingerprint);
      if(!reservation.created){if(!reservation.record)throw failed();return replay(reservation.record);}
      await prepared.apply(tx);
      await tx.completeRequest(keyHash,prepared.receipt);
      return {replayed:false,receipt:{...prepared.receipt},value:prepared.value};
    });
  } catch(error) {if(isIssuanceRequestConflict(error))throw new IssuanceRequestConflict();throw failed();} // Never auto-retry ambiguous COMMIT.
}
