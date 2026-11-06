'use strict';
const original=require('../localhost-run-smoke/transport.cjs');
function sshArgs(port,knownHosts){return[...original.sshArgs(port,knownHosts),'--inject-http-proxy-headers'];}
module.exports={...original,sshArgs};
