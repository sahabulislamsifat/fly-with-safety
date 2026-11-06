const {test}=require('node:test'),a=require('node:assert/strict'),{sshEnvironment,exitEvidence}=require('./ssh-environment.cjs');
test('ProgramData retained, credentials and SSH agent excluded',()=>{const r=sshEnvironment({SystemRoot:'C:/Windows',ProgramData:'C:/ProgramData',SSLCOMMERZ_STORE_PASSWORD:'secret',DATABASE_URL:'secret',SSH_AUTH_SOCK:'agent'});a.equal(r.ProgramData,'C:/ProgramData');a.deepEqual(Object.keys(r).sort(),['ProgramData','SystemRoot']);});
test('missing required native environment fails before spawn',()=>a.throws(()=>sshEnvironment({SystemRoot:'C:/Windows'})));
test('native status is preserved without raw logs',()=>a.deepEqual(exitEvidence(255,null),{nativeExitCode:255,signal:null}));
