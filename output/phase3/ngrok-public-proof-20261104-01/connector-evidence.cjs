'use strict';
function codes(text){return [...new Set((String(text).match(/\bERR_NGROK_\d{1,8}\b/g)||[]))].slice(0,8);}
function inspectLine(line,origin){
 const found=codes(line);if(found.length)return{failure:'NGROK_START_REJECTED',detail:{classification:'NGROK',codes:found}};
 let r;try{r=JSON.parse(line);}catch{return null;}
 if(r.msg!=='started tunnel')return null;
 if(r.url!==origin)return{failure:'NGROK_EXACT_HOSTNAME_MISMATCH'};
 let u;try{u=new URL(r.addr);}catch{return{failure:'NGROK_UPSTREAM_UNCONFIRMED'};}
 if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.port!=='5000'||u.pathname!=='/'||u.username||u.password||u.search||u.hash)return{failure:'NGROK_UPSTREAM_MISMATCH'};
 return{bindingAccepted:true,exactHostname:true,exactUpstream:true,policySubmitted:true,policyRuntimeAccepted:true,accountIdentityRead:false};
}
function waitForConnector(child,origin,journal,timeout=60000){
 return new Promise((resolve,reject)=>{
  let settled=false;const buffers=new Map();
  const cleanup=()=>{clearTimeout(timer);for(const stream of [child.stdout,child.stderr])stream.removeListener('data',onData);child.removeListener('error',onError);child.removeListener('exit',onExit);};
  const end=(error,value)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(value);};
  const onError=()=>end(Error('NGROK_PROCESS_START_FAILED'));
  const onExit=()=>end(Error('NGROK_EXIT_BEFORE_BINDING'));
  function onData(chunk){
   const text=((buffers.get(this)||'')+chunk.toString('utf8')).slice(-16384);const lines=text.split(/\r?\n/);buffers.set(this,lines.pop());
   for(const line of lines){const r=inspectLine(line,origin);if(!r)continue;if(r.failure){journal('connector-rejected',{failure:r.failure,codes:r.detail?.codes||[]});end(Object.assign(Error(r.failure),{detail:r.detail||null}));return;}journal('authenticated-exact-binding-accepted',r);end(null,r);return;}
  }
  const timer=setTimeout(()=>end(Error('NGROK_BINDING_TIMEOUT')),timeout);
  child.stdout.on('data',onData);child.stderr.on('data',onData);child.once('error',onError);child.once('exit',onExit);
 });
}
module.exports={inspectLine,waitForConnector};
