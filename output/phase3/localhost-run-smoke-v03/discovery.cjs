'use strict';
const {publicOrigin}=require('../localhost-run-smoke/transport.cjs');
function endpoint(value){
 if(typeof value!=='string')return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(['localhost.run','admin.localhost.run','www.localhost.run','docs.localhost.run','status.localhost.run'].includes(u.hostname))return null;
 try{return publicOrigin(value);}catch{return null;}
}
function inspectLine(line){
 let json;try{json=JSON.parse(line);}catch{}
 let candidates=[];
 if(json&&typeof json==='object'&&!Array.isArray(json)){
 const kind=[json.event,json.type,json.message,json.msg].filter(x=>typeof x==='string').join(' ');
 if(/tunnel|forward|allocat/i.test(kind))for(const key of ['url','address','public_url','publicUrl']){const u=endpoint(json[key]);if(u)candidates.push(u);}
 }
 // Only allocation-labelled complete output; help/login URLs are never readiness.
 if(/tunneled with tls termination|forwarding (?:https|connections)|tunnel (?:allocated|ready|available)/i.test(line)){
 for(const raw of line.match(/https:\/\/[a-z0-9.-]+(?:\/[^\s"<>]*)?/gi)||[]){const u=endpoint(raw);if(u)candidates.push(u);}
 }
 candidates=[...new Set(candidates)];
 if(candidates.length>1)throw Error('AMBIGUOUS_ALLOCATION');
 return candidates[0]||null;
}
function reader(){let buffer='';return chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>32768)throw Error('READINESS_LINE_LIMIT');const lines=buffer.split(/\r?\n/);buffer=lines.pop();return lines.map(inspectLine).filter(Boolean);};}
module.exports={endpoint,inspectLine,reader};
