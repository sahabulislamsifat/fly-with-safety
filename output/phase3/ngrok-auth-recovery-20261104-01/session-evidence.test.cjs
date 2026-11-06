'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const{inspect}=require('./session-evidence.cjs');
test('configuration/client-connect chatter is not successful authentication',()=>{for(const msg of ['open config file','client session established','starting web service'])assert.equal(inspect(JSON.stringify({msg})),null);});
test('only session-start acknowledgement passes',()=>assert.equal(inspect('{"msg":"tunnel session started","lvl":"info"}').authenticatedSessionStarted,true));
test('ERR_NGROK_105 retained without raw credential',()=>{const r=inspect('private_synthetic ERR_NGROK_105 private_synthetic');assert.deepEqual(r,{failure:'NGROK_AUTH_REJECTED',codes:['ERR_NGROK_105']});assert.ok(!JSON.stringify(r).includes('private_synthetic'));});
test('unexpected public endpoint event fails even though session could be valid',()=>assert.equal(inspect('{"msg":"started tunnel","url":"https://private.invalid"}').failure,'UNEXPECTED_ENDPOINT_EVENT'));
test('first error/warning stops rather than triggering retry',()=>{for(const lvl of ['eror','error','warn'])assert.equal(inspect(JSON.stringify({lvl,msg:'private details'})).failure,'NGROK_SESSION_ERROR');});
test('unknown fields/invalid JSON discarded',()=>{assert.equal(inspect('not-json private'),null);assert.equal(inspect('{"token":"private","msg":"unrelated"}'),null);});
