'use strict';
const {exitEvidence}=require('../localhost-run-smoke/ssh-environment.cjs');
function diagnostics(child){
 const state={...exitEvidence(null,null),spawnError:null,stdoutBytes:0,stderrBytes:0,categories:[]};
 for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]]){let tail='';stream.on('data',b=>{state[name+'Bytes']+=b.length;tail=(tail+b.toString('utf8')).slice(-4096);for(const [id,re] of Object.entries({HOST_KEY_REJECTED:/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i,AUTH_REJECTED:/Permission denied|authentication failed/i,FORWARD_REJECTED:/remote port forwarding failed|administratively prohibited/i,DNS_FAILURE:/Could not resolve hostname/i,NETWORK_FAILURE:/Connection refused|Connection timed out|Network is unreachable|Connection reset/i,REMOTE_COMMAND_REJECTED:/unknown (?:command|option)|invalid (?:command|option)/i})){if(re.test(tail)&&!state.categories.includes(id))state.categories.push(id);}});}
 child.on('error',e=>{state.spawnError=['ENOENT','EACCES','EPERM'].includes(e.code)?e.code:'OTHER';});
 child.on('exit',(code,signal)=>Object.assign(state,exitEvidence(code,signal)));
 return state;
}
async function stopOwned(child,budget=5000){
 if(!child||child.exitCode!==null||child.signalCode!==null)return true;
 return new Promise(resolve=>{const t=setTimeout(()=>{child.removeListener('exit',done);resolve(false);},budget);function done(){clearTimeout(t);resolve(true);}child.once('exit',done);try{if(!child.kill()){clearTimeout(t);child.removeListener('exit',done);resolve(false);}}catch{clearTimeout(t);child.removeListener('exit',done);resolve(false);}});
}
module.exports={diagnostics,stopOwned};
