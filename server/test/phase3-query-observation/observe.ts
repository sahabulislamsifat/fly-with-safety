import {oneQuery,type Intent} from '../phase3-intent-query/query.js';
import {minor} from '../../src/payments/sslcommerz.js';
const financialStatuses=['VALID','VALIDATED','FAILED','CANCELLED','EXPIRED','UNATTEMPTED','PENDING'];
function type(v:unknown){return v===undefined?'ABSENT':v===null?'NULL':Array.isArray(v)?'ARRAY':typeof v==='object'?'OBJECT':typeof v==='string'?'STRING':typeof v==='number'?'NUMBER':typeof v==='boolean'?'BOOLEAN':'OTHER';}
function status(v:unknown){return typeof v==='string'&&[...financialStatuses,'CANCEL','SUCCESS','DONE','INACTIVE','INVALID_REQUEST'].includes(v)?v:v===undefined?'ABSENT':'OTHER';}
function money(v:unknown){try{return typeof v==='string'?minor(v).toString():null;}catch{return null;}}
function text(v:unknown){return typeof v==='string'&&v.length>0&&v.length<=100;}
export function classifyBody(bytes:Uint8Array,intent:Intent,storeId:string){
 let raw:unknown;try{raw=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{return{json:'INVALID_OR_EMPTY',bodyBytes:bytes.length,failurePaths:['RESPONSE_JSON']};}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return{json:type(raw),bodyBytes:bytes.length,failurePaths:['RESPONSE_NOT_OBJECT']};
 const r=raw as Record<string,unknown>,paths:string[]=[];if(r.APIConnect!=='DONE')paths.push('API_CONNECT_NOT_DONE');if(!Array.isArray(r.element))paths.push('ELEMENT_NOT_ARRAY');else if(r.element.length>20)paths.push('ELEMENT_LIMIT');
 const rows=Array.isArray(r.element)?r.element.slice(0,20).map((v:unknown,index:number)=>{
 const errors:string[]=[];if(!v||typeof v!=='object'||Array.isArray(v))return{index,type:type(v),failurePaths:['RECORD_NOT_OBJECT']};
 const d=v as Record<string,unknown>,amount=money(d.amount),converted=d.currency_amount===undefined?undefined:money(d.currency_amount);
 const recordStatus=typeof d.status==='string'?d.status:'';if(!financialStatuses.includes(recordStatus))errors.push('STATUS_ENUM');if(!amount)errors.push('AMOUNT_STRING_OR_RANGE');if(d.currency!=='BDT')errors.push('CURRENCY_NOT_BDT');if(d.currency_type!==undefined&&d.currency_type!=='BDT')errors.push('CURRENCY_TYPE_NOT_BDT');if(converted!==undefined&&(!converted||converted!==amount))errors.push('CURRENCY_AMOUNT_INVALID_OR_MISMATCH');if(['VALID','VALIDATED'].includes(recordStatus)&&!['0','1',0,1].includes(d.risk_level as string|number))errors.push('RISK_VALUE');if(!text(d.tran_id))errors.push('TRANSACTION_ID_TYPE');if(d.val_id&&!text(d.val_id))errors.push('VALIDATION_ID_TYPE');if(d.bank_tran_id&&!text(d.bank_tran_id))errors.push('BANK_ID_TYPE');
 return{index,status:status(d.status),amountType:type(d.amount),amountValid:!!amount,amountMatchesIntent:amount===intent.amountMinor,currency:d.currency==='BDT'?'BDT':type(d.currency)==='ABSENT'?'ABSENT':'OTHER',currencyType:d.currency_type==='BDT'?'BDT':type(d.currency_type)==='ABSENT'?'ABSENT':'OTHER',currencyAmountType:type(d.currency_amount),currencyAmountValid:converted===undefined?null:!!converted,currencyAmountMatches:converted===undefined?null:!!converted&&converted===amount,transactionMatches:d.tran_id===intent.tranId,riskType:type(d.risk_level),riskRecognized:['0','1',0,1].includes(d.risk_level as string|number),validationIdPresent:!!d.val_id,bankIdPresent:!!d.bank_tran_id,failurePaths:errors};
 }):[];
 return{json:'OBJECT',bodyBytes:bytes.length,apiConnect:status(r.APIConnect),topStatus:status(r.status),elementType:type(r.element),recordCount:Array.isArray(r.element)?r.element.length:null,merchantEchoPresent:r.store_id!==undefined,merchantEchoMatches:r.store_id===undefined?null:r.store_id===storeId,failurePaths:paths,records:rows};
}
export function observedQuery(intent:Intent,merchant:{id:string;password:string},transport:typeof fetch=fetch){
 let observation:object={stage:'NO_HTTP_RESPONSE'};
 const observe:typeof fetch=async(input,init)=>{const response=await transport(input,init);const ct=response.headers.get('content-type')||'';observation={stage:'HTTP_RESPONSE',httpStatus:response.status,contentType:/json/i.test(ct)?'JSON':/html/i.test(ct)?'HTML':/^text\//i.test(ct)?'TEXT':ct?'OTHER':'ABSENT'};
 const reader=response.clone().body?.getReader();if(!reader){observation={...observation,bodyAbsent:true};return response;}
 const chunks:Uint8Array[]=[];let size=0;try{for(;;){const n=await reader.read();if(n.done)break;size+=n.value.length;if(size>131072){observation={...observation,bodyLimitExceeded:true};void reader.cancel().catch(()=>{});return response;}chunks.push(n.value);}observation={...observation,...classifyBody(Buffer.concat(chunks),intent,merchant.id)};}catch{observation={...observation,bodyObservationFailed:true};}return response;};
 const query=oneQuery(intent,merchant,observe);return{run:query.run,attempts:query.attempts,observation:()=>({diagnosticOnly:true,authorizesPayment:false,...observation})};
}
