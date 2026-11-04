const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
(async()=>{
 const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'pins.json'),'utf8'));if(pins.some(p=>sha(p.path)!==p.sha256))throw Error('BROWSER_SOURCE_OR_EVIDENCE_PIN_MISMATCH');
 const hashes=JSON.parse(fs.readFileSync(path.join(__dirname,'review-hashes.json'),'utf8'));if(sha(path.join(__dirname,'Invoke-BrowserHost.ps1'))!==hashes.callerSha256)throw Error('BROWSER_CALLER_MISMATCH');
 for(const n of ['attempt-started.json','ready.json','host-result.json','caller-result.json','host-journal.jsonl','retained-browser-records.json','finalization.json','stop-request.json'])if(fs.existsSync(path.join(__dirname,n)))throw Error('EXISTING_BROWSER_ATTEMPT_NO_RETRY');
 for(const n of ['double-bundled.json','double-native.json']){const r=JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));if(!r.success||r.numPassedTests!==14||r.numFailedTests||r.numPendingTests)throw Error('BROWSER_DOUBLE_GUARD_TESTS_INCOMPLETE');}
 const sql=fs.readFileSync(path.join(__dirname,'preflight.readonly.sql'),'utf8');if(!sql.startsWith('BEGIN READ ONLY;')||!sql.trimEnd().endsWith('ROLLBACK;'))throw Error('BROWSER_PREFLIGHT_NOT_READONLY');
 const ast=await parser.parse(sql);let blocks=0;
 for(const m of sql.matchAll(/DO (\$[a-z]+\$)([\s\S]*?)\1;/g)){await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS '+m[1]+m[2]+m[1]+' LANGUAGE plpgsql;');blocks++;}
 const source=fs.readFileSync(path.join(root,'server/test/phase3-browser-host.pg.integration.ts'),'utf8');let queries=0;
 for(const m of source.matchAll(/Prisma\.sql`([\s\S]*?)`/g)){await parser.parse(m[1].replace(/\$\{[^}]+\}/g,'NULL'));queries++;}
 if(!source.includes("vi.mock('../src/payments/sslcommerz.js'")||!source.includes('PHASE3_BROWSER_EXTERNAL_FETCH_FORBIDDEN')||!source.includes("outer.listen(5000, 'localhost'")||!source.includes("FRONTEND_URL: 'http://localhost:3000'")||!source.includes("phase: 3, provider: 'MOCK_ONLY', browser: true"))throw Error('BROWSER_ISOLATION_OR_PROVIDER_GUARD_MISSING');
 const local=createRequire(path.join(root,'client/eslint.config.mjs')),{ESLint}=local('eslint'),ts=createRequire(local.resolve('eslint-config-next'))('typescript-eslint');
 const lint=await new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:ts.configs.recommended}).lintFiles(['server/test/phase3-browser-host.pg.integration.ts','server/test/phase3-browser-host.pg.vitest.config.ts','server/test/phase3-browser-double.ts','server/test/phase3-browser-double.test.ts']);
 const errors=lint.reduce((n,r)=>n+r.errorCount,0),warnings=lint.reduce((n,r)=>n+r.warningCount,0);
 fs.writeFileSync(path.join(__dirname,'eslint.json'),JSON.stringify({errors,warnings,files:lint.map(r=>({path:path.relative(root,r.filePath),messages:r.messages}))},null,2));if(errors||warnings)throw Error('BROWSER_LINT_FAILED');
 const report={passed:true,pins:pins.length,newOfflineTestsPerLoader:14,failures:0,skips:0,sqlStatements:ast.stmts.length,plpgsqlBlocks:blocks,hostQueriesParsed:queries,eslintErrors:errors,eslintWarnings:warnings,old64ProofRerun:false,browserAuthenticatedTestsExecuted:0,databaseExecuted:false,providerCalled:false,attemptExists:false,callerSha256:hashes.callerSha256};
 fs.writeFileSync(path.join(__dirname,'offline-review.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e.message);process.exitCode=1});
