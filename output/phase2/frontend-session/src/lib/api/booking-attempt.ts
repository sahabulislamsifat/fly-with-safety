import {ApiError} from './client';

export function isTerminalBookingFailure(error:unknown):boolean {
  return error instanceof ApiError && error.status>=400 && error.status<500 && error.status!==408 && error.status!==429;
}

/** One mounted form intent. Memory-only identity/revision; never retains the
 * passenger payload, a payload digest, browser storage, or automatic retries. */
export function createBookingAttempt(){
  let revision=0,busy=false,current:string|undefined;
  return {
    invalidate(){revision++;current=undefined;},
    begin(){
      if(busy)return null;
      if(!current){
        const id=globalThis.crypto?.randomUUID();
        if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw new Error('Secure request identity unavailable.');
        current=id;
      }
      busy=true;let settled=false;const captured=revision,requestId=current;
      return {requestId,settle(terminal:boolean){if(settled)return;settled=true;busy=false;if(terminal&&captured===revision)current=undefined;}};
    },
  };
}
