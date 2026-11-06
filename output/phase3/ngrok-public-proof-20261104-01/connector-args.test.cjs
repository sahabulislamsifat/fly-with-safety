'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{configList,authArgs,publicArgs}=require('./connector-args.cjs');
const auth=path.resolve('private-auth.yml'),safety=path.resolve('agent-safety.yml'),policy=path.resolve('policy.json'),origin='https://russel-semisacred-elise.ngrok-free.dev';
test('exact explicit config list includes only file paths once, no credential value',()=>{const a=authArgs(auth,safety);assert.deepEqual(a.slice(0,2),['start','--none']);assert.equal(a.filter(v=>v==='--config').length,1);assert.equal(a[a.indexOf('--config')+1],`${auth},${safety}`);assert.ok(!a.includes('--authtoken'));assert.ok(!a.includes('--all'));});
test('path delimiter/relative override rejected before session',()=>{for(const p of ['relative.yml',auth+',extra.yml',auth+'\nextra'])assert.throws(()=>configList(p,safety));});
test('public scope fixed to isolated loopback and assigned domain',()=>{const a=publicArgs(origin,auth,safety,policy);assert.deepEqual(a.slice(0,4),['http','http://127.0.0.1:5000','--url',origin]);assert.ok(a.includes('--inspect=false'));assert.ok(!a.includes('--authtoken'));assert.throws(()=>publicArgs('https://app.acme.com',auth,safety,policy));});
