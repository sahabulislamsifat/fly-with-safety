import {randomBytes} from 'node:crypto';
import {SSLCommerzClient,type Evidence} from '../../src/payments/sslcommerz.js';
export type Intent={tranId:string;amountMinor:string;currency:string};
/** Exactly one read-only merchant transaction query. Never exports its URL/body. */
export function oneQuery(intent:Intent,merchant:{id:string;password:string},transport:typeof fetch=fetch){
 let attempts=0,started=false;intent=Object.freeze({...intent});merchant=Object.freeze({...merchant});
 const guarded:typeof fetch=async(input,init)=>{
 const u=input instanceof URL?input:new URL(typeof input==='string'?input:input.url);
 if(attempts!==0||u.origin!=='https://sandbox.sslcommerz.com'||u.pathname!=='/validator/api/merchantTransIDvalidationAPI.php'||init?.method!=='GET'||init.redirect!=='error'||u.searchParams.get('tran_id')!==intent.tranId||u.searchParams.get('store_id')!==merchant.id||u.searchParams.get('store_passwd')!==merchant.password)throw Error('ONE_QUERY_BOUNDARY_DENIED');
 attempts++;return transport(input,init);
 };
 const client=new SSLCommerzClient({storeId:merchant.id,password:merchant.password,callbackOrigin:'https://unused.invalid',frontendOrigin:'http://127.0.0.1',storageKey:randomBytes(32),refunds:false},guarded);
 return{async run(){if(started)throw Error('QUERY_ALREADY_CONSUMED');started=true;const rows=await client.query(intent.tranId);return summarize(rows,intent);},attempts:()=>attempts};
}
export function summarize(rows:Evidence[],intent:Intent){
 if(rows.some(r=>r.tranId!==intent.tranId||r.amountMinor!==intent.amountMinor||r.currency!==intent.currency))throw Error('AUTHORITATIVE_TRANSACTION_MISMATCH');
 const outcomes=rows.map(r=>({status:r.status,risk:r.risk,validationIdPresent:!!r.valId,bankIdPresent:!!r.bankId}));
 return{queryCompleted:true,recordCount:rows.length,outcomes,matching:true,continuationEligible:rows.length===1&&!rows[0].risk&&['FAILED','CANCELLED','EXPIRED','UNATTEMPTED'].includes(rows[0].status),paymentStatusChanged:false,paidAuthorized:false,genuineNegativeE2EAccepted:false};
}
