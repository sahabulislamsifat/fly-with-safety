const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../../..'),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').toUpperCase();
if(['attempt-started.json','proof-attempt.json','proof-result.json','caller-result.json','readonly-stdout.txt'].some(n=>fs.existsSync(path.join(base,n))))throw Error('EXISTING_ATTEMPT_DO_NOT_REBUILD');
const schemaBase=path.join(root,'output/phase3/code-foundation-20261103/schema-review');
const oldPins=JSON.parse(fs.readFileSync(path.join(schemaBase,'pins.json'),'utf8'));
for(const p of oldPins)if(sha(p.path)!==p.sha256)throw Error('ACCEPTED_SCHEMA_SOURCE_CHANGED');
const sourceArchive=path.join(base,'source-before/phase3-ledger.pg.integration.ts');
const oldSources=JSON.parse(fs.readFileSync(path.join(root,'output/phase3/code-foundation-20261103/source-manifest.json'),'utf8'));
if(sha(sourceArchive)!==oldSources.find(p=>p.path==='server/test/phase3-ledger.pg.integration.ts').sha256)throw Error('ORIGINAL_PREPARED_TEST_ARCHIVE_MISMATCH');
const testSource=fs.readFileSync(path.join(root,'server/test/phase3-ledger.pg.integration.ts'),'utf8');
const checks=[...testSource.matchAll(/\bcheck\('([a-z0-9-]+)'/g)].map(m=>m[1]);
checks.push(...['unavailable','amount','currency','transaction'].map(m=>m+'-cannot-authorize-capture'));
if(new Set(checks).size!==checks.length)throw Error('DUPLICATE_PLANNED_CHECK');
fs.writeFileSync(path.join(base,'test-contract.json'),JSON.stringify({checks,provider:'MOCK_ONLY',caseTimeoutMs:60000,admissionBudgetMs:45000},null,2));
const files=[...oldPins.map(p=>p.path),...['attempt.json','stdout.txt','result.json','Invoke-Phase3Schema.ps1','pins.json'].map(n=>path.join(schemaBase,n)),...['Set-PrivateConnection.ps1','verify-private-url.cjs','preflight.readonly.sql','schema-acceptance.json','test-contract.json'].map(n=>path.join(base,n)),
 ...['server/test/phase3-ledger.pg.integration.ts','server/test/phase3-ledger.pg.vitest.config.ts','server/test/phase3-proof-diagnostics.ts','server/package.json','server/pnpm-lock.yaml','server/node_modules/vitest/vitest.mjs'].map(n=>path.join(root,n))];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:ts|js|mjs|json|prisma|wasm)$/.test(e.name))files.push(p)}}walk(path.join(root,'server/src'));
const local=require('node:module').createRequire(path.join(root,'server/package.json'));
for(const name of ['pg','bcryptjs','@prisma/adapter-pg','@prisma/client','zod','vitest','typescript','dotenv']){
 const entry=local.resolve(name);files.push(entry);let d=path.dirname(entry);while(!fs.existsSync(path.join(d,'package.json'))&&path.dirname(d)!==d)d=path.dirname(d);if(fs.existsSync(path.join(d,'package.json')))files.push(path.join(d,'package.json'));
}
const pins=[...new Set(files)].map(p=>({path:p,sha256:sha(p)}));fs.writeFileSync(path.join(base,'pins.json'),JSON.stringify(pins,null,2));
const caller=path.join(base,'Invoke-PostgresProof.ps1');let text=fs.readFileSync(caller,'utf8');text=text.replace(/-cne '(?:__MANIFEST_SHA__|[A-F0-9]{64})'\)\{throw 'STOP: payment proof manifest mismatch'/,`-cne '${sha(path.join(base,'pins.json'))}'){throw 'STOP: payment proof manifest mismatch'`);if(text.includes('__MANIFEST_SHA__'))throw Error('CALLER_PLACEHOLDER_REMAINING');fs.writeFileSync(caller,text);
const report={pins:pins.length,plannedChecks:checks.length,callerSha256:sha(caller),manifestSha256:sha(path.join(base,'pins.json')),originalPreparedTestPreserved:true,runtimeSchemaPinsUnchanged:true,approved:false,databaseExecuted:false};
fs.writeFileSync(path.join(base,'review-hashes.json'),JSON.stringify(report,null,2));console.log(report);
