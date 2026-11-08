'use strict';
// Preload for owned Node processes only. No financial/cloud/provider egress.
const net=require('node:net'),http=require('node:http'),https=require('node:https');
function allowed(host,port,frontend=false){return (['127.0.0.1','localhost','::1'].includes(host)&&[38191,38192,...(frontend?[]:[5432])].includes(Number(port)))||(frontend&&['fonts.googleapis.com','fonts.gstatic.com'].includes(host)&&Number(port)===443);}
function block(){throw Object.assign(Error('TEST_NETWORK_BOUNDARY'),{guard:'TEST_NETWORK_BOUNDARY'});}
function install(){
  if(process.env.FWS_P5_FRONTEND_ONLY==='true'){
    const {createRequire}=require('node:module'),path=require('node:path');
    const nextRequire=createRequire(require('node:fs').realpathSync(path.resolve(__dirname,'../../../client/node_modules/next/package.json')));
    const key=nextRequire.resolve('@next/env'),env=nextRequire('@next/env');
    // This synthetic process uses only its explicit allowlisted configuration.
    require.cache[key].exports={...env,loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})};
  }
  const front=process.env.FWS_P5_FRONTEND_ONLY==='true',original=net.Socket.prototype.connect;
  net.Socket.prototype.connect=function(...args){const a=Array.isArray(args[0])?args[0]:args;const o=typeof a[0]==='object'?a[0]:{port:a[0],host:typeof a[1]==='string'?a[1]:'localhost'};
    if(o.path){if(!String(o.path).startsWith('\\\\.\\pipe\\'))block();}else if(!allowed(o.host||o.hostname||'localhost',o.port,front))block();return original.apply(this,args);};
  for(const module of [http,https])for(const key of ['request','get']){const fn=module[key];module[key]=function(...args){const first=args[0];const o=typeof first==='string'||first instanceof URL?new URL(first):first;const host=o.hostname||o.host||'localhost',port=o.port||(module===https?443:80);if(!allowed(host,port,front)||o.username||o.password||o.auth)block();return fn.apply(this,args);};}
  const fetch=globalThis.fetch;globalThis.fetch=function(input,options){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!allowed(url.hostname,url.port||(url.protocol==='https:'?443:80),front)||url.username||url.password)block();return fetch(input,options);};
}
module.exports={allowed,install};
if(process.env.FWS_P5_NETWORK_FENCE==='true')install();
