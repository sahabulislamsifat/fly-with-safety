'use strict';
// Offline only: no caller, DB, SSH, provider or private config is executed/read.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const base=__dirname,repo=path.resolve(base,'../../..'),old=path.join(repo,'output/phase3/genuine-sandbox-e2e-20261104-01'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase(),read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
(async()=>{let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
 const psFile=path.join(base,'Invoke-ReadOnlyPreflight.ps1'),ps=read(psFile),runner=read(path.join(repo,'server/test/phase3-db-preflight-readonly.ts')),original=read(path.join(repo,'server/test/phase3-genuine/preflight.ts')),changed=read(path.join(repo,'server/test/phase3-db-preflight-v02.ts'));
 const guardBody=s=>s.slice(s.indexOf('export async function preflight'),s.indexOf('export async function preserve'));check(guardBody(original)===guardBody(changed),'all identity/migration/ownership/privilege guards exact unchanged');
 const oldCatalog=original.match(/catalog:await db\.\$queryRawUnsafe\("([\s\S]*?)"\),/)[1],copiedCatalog=changed.match(/originalCatalogSQL="([\s\S]*?)";/)[1];check(oldCatalog===copiedCatalog,'original SQL retained exactly');
 for(const p of JSON.parse(read(path.join(old,'pins.json'))))check(hash(path.resolve(old,p.path))===p.sha256,'historical source unchanged '+p.path);
 check(hash(path.join(old,'Invoke-GenuineSandbox.ps1'))==='39F9BF85FD340AFADF5A641B2A19EF62632204B9C4E869D9091480806299B798','consumed caller unchanged');
 check(ps.includes('param([switch]$OwnerApprovedReadOnlyPreflight)'),'caller switch');check(ps.includes('[IO.Path]::IsPathRooted($pin.path)'),'absolute runtime path resolution');check(ps.includes('--owner-approved-readonly-preflight')&&runner.includes("process.argv[2]!=='--owner-approved-readonly-preflight'"),'runner flag/order');
 check(ps.includes("['PHASE3_READONLY_APPROVED']='true'")&&runner.includes("process.env.PHASE3_READONLY_APPROVED!=='true'"),'second process gate');
 check(ps.includes("server\\test\\phase3-db-preflight-readonly.ts")&&ps.includes("server\\node_modules\\tsx\\dist\\cli.mjs"),'installed paths');
 check(ps.includes('-AsSecureString')&&ps.includes('ZeroFreeBSTR')&&!ps.includes('Write-Host $url'),'private password handling');
 check(runner.includes("options:'-c default_transaction_read_only=on'")&&runner.includes("SET TRANSACTION READ ONLY"),'server-enforced readonly');
 check(runner.includes('throw rollbackSentinel')&&runner.includes('e===rollbackSentinel'),'controlled rollback');
 check(runner.indexOf("if(r.rows.length!==1")<runner.indexOf('pool.query(originalCatalogSQL)'),'identity before catalog');
 check(!/dotenv|SSLCommerzClient|spawn\(|createServer\(|\.listen\(/.test(runner),'no secret config/public/provider runtime');
 for(const n of ['caller-attempt.json','attempt.json','result.json','caller-result.json'])check(!fs.existsSync(path.join(base,n)),'no attempt '+n);
 // Parse every static SELECT, plus the actual old/corrected catalog projections.
 const ts=require(path.join(repo,'server/node_modules/typescript')),parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query'),sql=[];
 for(const text of [changed,runner]){const source=ts.createSourceFile('offline.ts',text,ts.ScriptTarget.Latest,true);function visit(n){if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/^SELECT\b/.test(n.text))sql.push(n.text);ts.forEachChild(n,visit);}visit(source);}
 sql.push(copiedCatalog.replace('c.relkind,','c.relkind::text AS relkind,').replace('c.relowner,','c.relowner::text AS relowner,').replace('a.atttypid,','a.atttypid::text AS atttypid,'));for(const query of sql){await parser.parse(query);checks++;}
 // Lint only new files. Never rewrite the original package's result files.
 const local=createRequire(path.join(repo,'client/eslint.config.mjs')),{ESLint}=local('eslint'),typescript=createRequire(local.resolve('eslint-config-next'))('typescript-eslint');const lint=new ESLint({cwd:repo,overrideConfigFile:true,overrideConfig:typescript.configs.recommended}),lintResult=await lint.lintFiles(['server/test/phase3-db-preflight-*.ts','server/test/phase3-preflight-adapter.test.ts']);const errors=lintResult.reduce((n,r)=>n+r.errorCount+r.warningCount,0);if(errors)console.log(JSON.stringify(lintResult.filter(r=>r.messages.length).map(r=>({path:r.filePath,messages:r.messages}))));check(errors===0,'lint');
 if(process.argv.includes('--build')){
 const runtime=JSON.parse(read(path.join(old,'runtime-pins.json'))).filter(p=>p.path.includes('server\\node_modules')||p.path==='C:\\Program Files\\nodejs\\node.exe');
 const sources=[...walk(path.join(repo,'server/src')).filter(p=>p.endsWith('.ts')),...walk(path.join(repo,'server/prisma/migrations')).filter(p=>p.endsWith('.sql')),...walk(old),...['server/test/phase3-db-preflight-v02.ts','server/test/phase3-db-preflight-diagnostics.ts','server/test/phase3-db-preflight-readonly.ts','server/test/phase3-preflight-adapter.test.ts','server/test/phase3-proof-diagnostics.ts','server/test/phase3-genuine/scope.ts','server/src/utils/error-fields.ts','server/package.json','server/pnpm-lock.yaml','server/prisma/schema.prisma'].map(p=>path.join(repo,p)),...['REVIEW.md','verify-review.cjs'].map(p=>path.join(base,p))];
 const pins=[...new Set(sources)].sort().map(p=>({path:path.relative(base,p),sha256:hash(p)}));for(const p of runtime){check(hash(p.path)===p.sha256,'runtime unchanged '+p.path);pins.push({path:p.path,sha256:p.sha256});}fs.writeFileSync(path.join(base,'pins.json'),JSON.stringify(pins,null,2));fs.writeFileSync(psFile,ps.replace(/'MANIFEST_HASH'|(?<=\.Hash -cne )'[A-F0-9]{64}'/,`'${hash(path.join(base,'pins.json'))}'`));
 }
 const pins=JSON.parse(read(path.join(base,'pins.json')));for(const p of pins)check(hash(path.resolve(base,p.path))===p.sha256,'pin '+p.path);check(read(psFile).includes(hash(path.join(base,'pins.json'))),'manifest/caller binding');
 const tests=JSON.parse(read(path.join(base,'tests-result.json')));check(tests.success&&tests.numFailedTests===0,'focused regression');
 const report={passed:true,checks,pins:pins.length,focusedTests:tests.numPassedTests,sqlSelects:sql.length,lintErrorsOrWarnings:errors,callerSHA256:hash(psFile),historicalPackageUnchanged:true,attemptAbsent:true,databaseExecuted:false,providerCalls:0,publicConnections:0};fs.writeFileSync(path.join(base,'offline-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
