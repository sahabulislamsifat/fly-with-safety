const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase(),read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
(async()=>{
 const pins=JSON.parse(read(path.join(__dirname,'pins.json')));for(const p of pins)if(sha(p.path)!==p.sha256)throw Error('PIN_MISMATCH');
 const hashes=JSON.parse(read(path.join(__dirname,'review-hashes.json')));
 if(sha(path.join(__dirname,'Invoke-RetainedProof.ps1'))!==hashes.callerSha256)throw Error('CALLER_MISMATCH');
 for(const name of ['attempt-started.json','proof-attempt.json','proof-result.json','caller-result.json','ledger.jsonl','readonly-stdout.txt','proof-stdout.txt','vitest-result.json'])if(fs.existsSync(path.join(__dirname,name)))throw Error('LIVE_ATTEMPT_ALREADY_EXISTS');
 const source=read(path.join(root,'server/test/phase3-ledger.pg.integration.ts')),before=read(path.join(__dirname,'source-before.ts'));
 const body=s=>s.slice(s.indexOf('    const calls ='),s.indexOf('\n  } catch (e)'));
 if(body(source)!==body(before))throw Error('FINANCIAL_ASSERTIONS_OR_OPERATIONS_CHANGED');
 if(!source.includes("process.env.PHASE3_RETAINED_OWNER_APPROVED !== 'true'")||/\.user\.create\(|\.booking\.create\(|bcrypt|validUntil: new Date/.test(source))throw Error('RETAINED_SCOPE_GUARD_MISSING');
 const contract=JSON.parse(read(path.join(__dirname,'test-contract.json')));
 const original=JSON.parse(read(path.join(root,'output/phase3/postgres-proof-20261103-01/test-contract.json')));
 if(JSON.stringify(contract.checks)!==JSON.stringify(original.checks)||contract.checks.length!==64||!source.includes('}, 60000);')||!source.includes('}, 45_000)'))throw Error('CONTRACT_OR_TIMEOUT_CHANGED');
 for(const n of ['fixtures-bundled.json','fixtures-native.json']){const r=JSON.parse(read(path.join(__dirname,n)));if(!r.success||r.numPassedTests!==14||r.numFailedTests||r.numPendingTests)throw Error('FIXTURE_GUARD_TESTS_INCOMPLETE');}
 for(const n of ['Set-PrivateConnection.ps1','verify-private-url.cjs'])if(sha(path.join(__dirname,n))!==sha(path.join(root,'output/phase3/postgres-proof-20261103-01',n)))throw Error('PRIVATE_CONNECTION_PATH_CHANGED');
 const sql=read(path.join(__dirname,'preflight.readonly.sql'));
 if(!sql.startsWith('BEGIN READ ONLY;')||!sql.trimEnd().endsWith('ROLLBACK;'))throw Error('READ_ONLY_ENFORCEMENT_MISSING');
 const ast=await parser.parse(sql);let blocks=0;
 for(const m of sql.matchAll(/DO (\$[a-z]+\$)([\s\S]*?)\1;/g)){await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS '+m[1]+m[2]+m[1]+' LANGUAGE plpgsql;');blocks++;}
 if(blocks!==2)throw Error('EXPECTED_IDENTITY_SCHEMA_AND_RETAINED_GUARDS');
 let queries=0;for(const m of source.matchAll(/Prisma\.sql`([\s\S]*?)`/g)){await parser.parse(m[1].replace(/\$\{[^}]+\}/g,'NULL'));queries++;}
 const report={passed:true,pins:pins.length,unchangedCheckpointIds:64,financialOperationsAndAssertionsUnchanged:true,unchangedCaseTimeoutMs:60000,unchangedAdmissionBudgetMs:45000,newFixtureGuardTestsPerLoader:14,failures:0,skips:0,preflightStatements:ast.stmts.length,plpgsqlBlocks:blocks,integrationQueriesParsed:queries,privateConnectionHelperUnchanged:true,fixtureCreation:false,quoteRefresh:false,liveAttemptExists:false,databaseExecuted:false,providerCalled:false,callerSha256:hashes.callerSha256};
 fs.writeFileSync(path.join(__dirname,'offline-review.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e.message);process.exitCode=1});
