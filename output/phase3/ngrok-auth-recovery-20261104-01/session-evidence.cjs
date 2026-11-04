'use strict';
function inspect(line){
 const codes=[...new Set((String(line).match(/\bERR_NGROK_\d{1,8}\b/g)||[]))].slice(0,8);
 if(codes.length)return{failure:'NGROK_AUTH_REJECTED',codes};
 let r;try{r=JSON.parse(line);}catch{return null;}
 if(r.msg==='started tunnel')return{failure:'UNEXPECTED_ENDPOINT_EVENT',codes:[]};
 if(r.lvl==='eror'||r.lvl==='error'||r.lvl==='warn')return{failure:'NGROK_SESSION_ERROR',codes:[]};
 return r.msg==='tunnel session started'?{authenticatedSessionStarted:true,noEndpointRequested:true}:null;
}
module.exports={inspect};
