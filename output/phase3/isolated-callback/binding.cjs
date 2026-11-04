'use strict';
// Log field names are not an upstream attestation. Require a correlated origin
// response as well as exact public URL acknowledgement before accepting binding.
function inspect(line,origin){
 const codes=[...new Set(String(line).match(/\bERR_NGROK_\d{1,8}\b/g)||[])];
 if(codes.length)return {failure:'NGROK_REJECTED',codes};
 let r;try{r=JSON.parse(line);}catch{return null;}
 if(r.msg!=='started tunnel')return null;
 if(r.url!==origin)return {failure:'EXACT_DOMAIN_MISMATCH'};
 return {hostnameAcknowledged:true,upstreamVerified:false,correlationRequired:true,addrPresent:Object.hasOwn(r,'addr'),addrType:typeof r.addr};
}
module.exports={inspect};
