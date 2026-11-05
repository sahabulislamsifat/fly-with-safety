'use strict';
function rawCount(req,name){let n=0;for(let i=0;i<(req.rawHeaders||[]).length;i+=2)if(String(req.rawHeaders[i]).toLowerCase()===name)n++;return n;}
function xfp(value){
 if(value===undefined)return 'ABSENT';if(typeof value!=='string'||value.length>256)return 'MALFORMED';
 if(value==='https')return 'EXACT_HTTPS';if(value==='http')return 'HTTP';
 const parts=value.split(',').map(x=>x.trim().toLowerCase());
 if(parts.length>1)return parts.every(p=>p==='https')?'HTTPS_LIST':parts.every(p=>p==='http')?'HTTP_LIST':parts.every(p=>['http','https'].includes(p))?'CONFLICT':'MALFORMED';
 return value.trim().toLowerCase()==='https'?'NONCANONICAL_HTTPS':'MALFORMED';
}
function forwarded(value){
 if(value===undefined)return 'ABSENT';if(typeof value!=='string'||value.length>2048)return 'MALFORMED';
 const elements=value.split(',');if(elements.length>8)return 'MALFORMED';const schemes=[];
 for(const element of elements){const params=element.split(';').map(p=>p.trim()).filter(p=>/^proto\s*=/i.test(p));if(params.length!==1)return 'MALFORMED';const m=params[0].match(/^proto=(?:"(https|http)"|(https|http))$/i);if(!m)return 'MALFORMED';schemes.push((m[1]||m[2]).toLowerCase());}
 return schemes.every(p=>p==='https')?(schemes.length===1?'HTTPS':'HTTPS_LIST'):schemes.every(p=>p==='http')?'HTTP':'CONFLICT';
}
function inspect(req,origin){
 const x=xfp(req.headers['x-forwarded-proto']),f=forwarded(req.headers.forwarded),host=origin?new URL(origin).host:null;
 const rawX=rawCount(req,'x-forwarded-proto'),rawF=rawCount(req,'forwarded');
 return{xfpClass:x,forwardedClass:f,xfpRawCount:Math.min(rawX,9),forwardedRawCount:Math.min(rawF,9),duplicateSchemeHeader:rawX>1||rawF>1,crossHeaderConflict:(x.includes('HTTPS')&&f==='HTTP')||(x==='HTTP'&&f.includes('HTTPS')),loopbackPeer:['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress),exactAssignedHost:!!host&&req.headers.host===host,metadataAuthority:'UNVERIFIED_PROXY_OVERWRITE_SEMANTICS',usedToAuthorize:false};
}
module.exports={inspect,xfp,forwarded};
