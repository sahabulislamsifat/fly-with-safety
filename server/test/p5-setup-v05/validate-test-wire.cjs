'use strict';
// Offline fixture test endpoint, never imported by the actual setup runner.
require('node:net').Socket.prototype.connect=function(){throw Error('OFFLINE_NETWORK_FORBIDDEN');};
let text='';process.stdin.on('data',value=>{text+=value;});
process.stdin.on('end',()=>{require('./policy.cjs').credentials(JSON.parse(Buffer.from(text.trim(),'base64').toString('utf8')));console.log('SYNTHETIC_WIRE_PASS');});
