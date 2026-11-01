import { ApiError } from './client';
export type AuthIssuanceOperation='register'|'password-reset'|'verification';
export function isTerminalAuthFailure(error:unknown):boolean {
  return error instanceof ApiError&&(error.code==='REGISTRATION_REPLAYED'||
    error.status>=400&&error.status<500&&error.status!==408&&error.status!==429);
}
export interface AuthAttemptTicket {requestId:string;settle(terminal:boolean):void}
export function newAuthRequestId():string {
  const id=globalThis.crypto?.randomUUID();
  if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw new Error('Secure request identity unavailable.');
  return id;
}
/** Memory only: stores no password/body/digest, uses no browser storage and performs no retry. */
export function createAuthAttempt() {
  let revision=0,busy=false,current:{operation:AuthIssuanceOperation;id:string}|undefined;
  return {
    invalidate(){revision++;current=undefined;},
    begin(operation:AuthIssuanceOperation):AuthAttemptTicket|null {
      if(busy)return null;
      if(!current||current.operation!==operation)current={operation,id:newAuthRequestId()};
      busy=true;const captured=revision,id=current.id;let settled=false;
      return {requestId:id,settle(terminal){if(settled)return;settled=true;busy=false;if(terminal&&captured===revision)current=undefined;}};
    },
  };
}
