'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{parseSummary,safeDiagnostic,streamDiagnostic,requireComplete}=require('./output-contract.cjs');
const pass={numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,success:true};
test('old stdout notice reproduces exact discarded-report defect',()=>{
  const text='JSON report written to synthetic/output.json\n';assert.throws(()=>JSON.parse(text));
  assert.throws(()=>parseSummary(text,0),{guard:'TEST_STDOUT_NOT_JSON'});assert.equal(streamDiagnostic(text).jsonReportNotice,true);
});
test('explicit stdout JSON accepted and passing native exit required',()=>assert.doesNotThrow(()=>requireComplete(parseSummary(JSON.stringify(pass)+'\n',0))));
for(const value of ['', 'noise\n'+JSON.stringify(pass),'{}','[]',JSON.stringify({...pass,numTotalTests:-1}),JSON.stringify({...pass,numPassedTests:'1'}),JSON.stringify({...pass,numTotalTests:2})])test('malformed or conflicting aggregate rejected: '+value.slice(0,35),()=>assert.throws(()=>parseSummary(value,0)));
for(const [label,r,exit]of[
  ['failed',{...pass,numPassedTests:0,numFailedTests:1,success:false},1],
  ['skipped',{...pass,numPassedTests:0,numPendingTests:1},0],
  ['empty',{...pass,numPassedTests:0,numTotalTests:0},0],
  ['nonzero-exit',pass,1],['signal',pass,null],['unsuccessful',{...pass,success:false},0],
])test(label+' is never full integration PASS',()=>assert.throws(()=>requireComplete(parseSummary(JSON.stringify(r),exit)),{guard:'POSTGRES_TEST_NOT_PASS'}));
test('safe native diagnostics retain codes, never error messages or URLs',()=>{
  const error={code:'P2010',message:'synthetic private password',meta:{driverAdapterError:{cause:{originalCode:'42501',message:'postgresql://synthetic:private@host/db'}}}};
  assert.deepEqual(safeDiagnostic(error),{prismaCode:'P2010',sqlState:'42501',nativeCode:null});
  assert(!JSON.stringify(safeDiagnostic(error)).includes('private'));
});
test('corrected config explicitly uses stdout and runner does not override reporter',()=>{
  const config=fs.readFileSync(path.join(__dirname,'vitest.config.ts'),'utf8'),runner=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');
  assert.match(config,/reporters: \[\['json', \{ stdout: true \}\]\]/);assert(!runner.includes('--reporter=json'));
  assert(runner.indexOf('state.childProcess={spawned:true,exitCode:code')<runner.indexOf('resolve(parseSummary(stdout,code))'));
  assert.match(runner,/finally\{[\s\S]*if\(state.preflightVerified\)[\s\S]*await observe\(input.password,false\)/);
  assert.match(runner,/setTimeout\(\(\)=>\{if\(child\)child.kill\(\);state.passed=false;state.deadlineExceeded=true;state.failure\|\|=/);
  assert.match(runner,/rollbackPreservation:null/);
});
