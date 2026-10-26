import { AuthDeliveryError, type Transport, type TransportMessage, type TransportOutcome } from './contracts.js';
import { exact, object, identifier, purpose, recipient, validToken } from './auth-delivery-codec.js';

/** No URLs or sockets. History intentionally retains no delivery body or recipient. */
export class FakeTransport implements Transport {
  enabled=true;
  outcomes:TransportOutcome[]=[];
  beforeSubmit?:()=>Promise<void>;
  private readonly records:{messageId:string;outcome:TransportOutcome}[]=[];
  history(){return this.records.map(r=>({...r}));}
  async submit(message:TransportMessage):Promise<TransportOutcome>{
    try{return await this.submitInternal(message);}catch{throw new AuthDeliveryError('TRANSPORT_TERMINAL');}
  }
  private async submitInternal(message:TransportMessage):Promise<TransportOutcome>{
    try{exact(object(message),['messageId','recipient','token','purpose']);}catch{throw new AuthDeliveryError('TRANSPORT_TERMINAL');}
    if(!identifier(message.messageId)||!recipient(message.recipient)||!purpose(message.purpose)||!validToken(message.token))throw new AuthDeliveryError('TRANSPORT_TERMINAL');
    if(this.beforeSubmit)await this.beforeSubmit();
    const candidate=this.enabled?(this.outcomes.shift()??'submitted'):'suppressed';
    const outcome=['submitted','suppressed','transientFailure','terminalFailure','ambiguous'].includes(candidate)?candidate:'terminalFailure';
    this.records.push({messageId:message.messageId,outcome});return outcome;
  }
}
