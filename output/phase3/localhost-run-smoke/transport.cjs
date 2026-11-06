'use strict';
const {allowed}=require('../isolated-callback/boundary.cjs');
function publicOrigin(value){
 let u;try{u=new URL(value);}catch{throw Error('INVALID_PUBLIC_ORIGIN');}
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!/^([a-z0-9-]+\.)+(lhr\.life|localhost\.run)$/.test(u.hostname))throw Error('INVALID_PUBLIC_ORIGIN');
 return u.origin;
}
function accept(req,origin){
 if(!origin)return false;
 const u=new URL(publicOrigin(origin));
 if(req.headers.host!==u.host||req.headers['x-forwarded-proto']!=='https')return false;
 // Only after dynamic exact-host/HTTPS guard, reuse original callback body/method/path/peer rules.
 return allowed({...req,headers:{...req.headers,host:'phase3-callback.invalid'}});
}
function sshArgs(port,knownHosts){
 if(!Number.isInteger(port)||port<1024||port>65535||[3000,5000].includes(port))throw Error('ISOLATED_PORT_REQUIRED');
 if(typeof knownHosts!=='string'||/[\r\n]/.test(knownHosts))throw Error('TRUST_FILE_REQUIRED');
 return ['-F','NUL','-T','-n','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${knownHosts}`,'-o','GlobalKnownHostsFile=NUL','-o','IdentityAgent=none','-o','IdentityFile=none','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=1','-R',`80:127.0.0.1:${port}`,'nokey@localhost.run','--','--output','json'];
}
module.exports={publicOrigin,accept,sshArgs};
