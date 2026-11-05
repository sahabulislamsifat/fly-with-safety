const {test}=require('node:test'),a=require('node:assert/strict'),{classify,decision}=require('./classify.cjs');
test('interstitial blocks rather than passes',()=>a.equal(decision(200,classify('ngrok','ERR_NGROK_6024'),false),'BLOCKED'));
test('unknown HTML never becomes GO',()=>a.equal(decision(200,classify('',''),false),'BLOCKED_UNCLASSIFIED_RESPONSE'));
test('404 only permits subsequent actual POST test',()=>a.equal(decision(404,classify('',''),false),'GO_TO_PROVIDER_POST_RETURN_TEST'));
test('title redacts email and tokens',()=>{const r=classify('test@example.invalid abcdefghijklmnopqrstuvwxyz','');a.equal(r.title.includes('test@'),false);a.equal(r.title.includes('abcdefghijklmnopqrstuvwxyz'),false);});
