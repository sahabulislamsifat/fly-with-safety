'use strict';
const path=require('node:path');
function configList(auth,safety){
 for(const f of [auth,safety])if(typeof f!=='string'||!path.isAbsolute(f)||/[\r\n,]/.test(f))throw Error('EXPLICIT_CONFIG_PATH_REQUIRED');
 // One --config string-list value, not separate repeated flags. Both files checked individually.
 return `${auth},${safety}`;
}
function authArgs(auth,safety){return['start','--none','--config',configList(auth,safety),'--log','stdout','--log-format','json','--log-level','info'];}
function publicArgs(origin,auth,safety,policy){
 if(origin!=='https://russel-semisacred-elise.ngrok-free.dev'||!path.isAbsolute(policy)||/[\r\n]/.test(policy))throw Error('EXACT_PUBLIC_SCOPE_REQUIRED');
 return['http','http://127.0.0.1:5000','--url',origin,'--config',configList(auth,safety),'--traffic-policy-file',policy,'--inspect=false','--log','stdout','--log-format','json','--log-level','info'];
}
module.exports={configList,authArgs,publicArgs};
