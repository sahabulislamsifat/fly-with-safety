'use strict';
function metadata(status,headers,body){
 const type=String(headers['content-type']||'').split(';')[0].toLowerCase();
 const html=type==='text/html';
 const warning=/ERR_NGROK_6024/i.test(body)&&/ngrok/i.test(body);
 let location='ABSENT';if(headers.location){try{location=new URL(headers.location,'https://russel-semisacred-elise.ngrok-free.dev').origin==='https://russel-semisacred-elise.ngrok-free.dev'?'SAME_ORIGIN':'OTHER_ORIGIN';}catch{location='INVALID';}}
 return {status,contentType:['text/html','application/json','text/plain'].includes(type)?type:'OTHER_OR_ABSENT',serverClass:/ngrok/i.test(String(headers.server||''))?'NGROK':'OTHER_OR_ABSENT',locationClass:location,setCookiePresent:!!headers['set-cookie'],ngrokErrorCodeHeader:/^ERR_NGROK_\d+$/.test(String(headers['ngrok-error-code']||''))?headers['ngrok-error-code']:null,classification:warning?'NGROK_WARNING_SIGNATURE':html?'HTML_UNCLASSIFIED':'NON_HTML',redirectsFollowed:0};
}
module.exports={metadata};
