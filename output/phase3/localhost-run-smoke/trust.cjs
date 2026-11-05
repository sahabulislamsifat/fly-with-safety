'use strict';
function keyLine(output){
 const lines=String(output).split(/\r?\n/).filter(s=>s&&!s.startsWith('#'));
 if(lines.length!==1||!/^localhost\.run ssh-ed25519 [A-Za-z0-9+/]+={0,2}$/.test(lines[0]))throw Error('TOFU_KEY_SCAN_INCONCLUSIVE');
 return lines[0]+'\n';
}
function discover(text){
 const matches=String(text).match(/https:\/\/[a-z0-9.-]+/g)||[];
 const {publicOrigin}=require('./transport.cjs');
 for(const candidate of matches){try{return publicOrigin(candidate);}catch{}}
 return null;
}
module.exports={keyLine,discover};
