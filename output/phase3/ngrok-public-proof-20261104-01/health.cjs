'use strict';
const targets=Object.freeze({backend:{url:'http://localhost:5000/api/v1/health',budgetMs:2000},frontend:{url:'http://localhost:3000/',budgetMs:4000}});
const nativeCodes=new Set(['EACCES','EPERM','ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);
function failure(error){
 const code=[error?.code,error?.cause?.code].find(c=>nativeCodes.has(c))||null;
 return {type:error?.name==='TimeoutError'?'TIMEOUT':error?.name==='AbortError'?'ABORT':code?'NETWORK':'UNCLASSIFIED',code};
}
async function one(kind,{fetchFn=globalThis.fetch,now=()=>performance.now(),signalFor=ms=>AbortSignal.timeout(ms)}={}){
 const target=targets[kind];if(!target)throw Error('UNKNOWN_LOCAL_HEALTH_TARGET');
 const started=now();const r={target:kind,url:target.url,budgetMs:target.budgetMs,expectedStatus:200,expectedDatabase:kind==='backend'?'up':null,status:null,media:null,jsonShape:null,database:null,environment:null,elapsedMs:0,passed:false,failure:null};
 try{
  const response=await fetchFn(target.url,{signal:signalFor(target.budgetMs)});
  r.status=Number.isInteger(response.status)?response.status:null;
  const media=response.headers?.get?.('content-type')?.split(';')[0]?.trim()?.toLowerCase();
  r.media=['application/json','text/html','text/plain'].includes(media)?media:media?'OTHER':'ABSENT';
  if(kind==='backend'){
   let body;try{body=await response.json();}catch(error){r.jsonShape='INVALID_JSON';r.failure=failure(error);return r;}
   r.jsonShape=body!==null&&typeof body==='object'&&!Array.isArray(body)&&body.data!==null&&typeof body.data==='object'&&!Array.isArray(body.data)?'DATA_OBJECT':'UNEXPECTED';
   r.database=['up','down'].includes(body?.data?.database)?body.data.database:body?.data?.database===undefined?'MISSING':'OTHER';
   r.environment=['development','production','test'].includes(body?.data?.environment)?body.data.environment:body?.data?.environment===undefined?'MISSING':'OTHER';
   // Exactly the original HTTP200 && data.database==='up' acceptance, no weakening.
   r.passed=response.status===200&&body?.data?.database==='up';
  }else{
   await response.body?.cancel();r.passed=response.status===200;
  }
  if(!r.passed)r.failure={type:'HEALTH_RESPONSE_MISMATCH',code:null};
 }catch(error){r.failure=failure(error);}
 finally{r.elapsedMs=Math.max(0,Math.round(now()-started));}
 return r;
}
async function checkHealth(options){const backend=await one('backend',options),frontend=await one('frontend',options);return{backend:backend.passed,frontend:frontend.passed,checks:{backend,frontend}};}
module.exports={checkHealth,one,failure,targets};
