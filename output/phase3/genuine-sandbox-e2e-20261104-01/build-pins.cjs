'use strict';
// Preparation only. Never use after approval; changing any approved bytes requires review.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const base=__dirname,repo=path.resolve(base,'../../..'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
if(fs.existsSync(path.join(base,'attempt.json')))throw Error('CONSUMED_NO_REVIEW_REBUILD');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const runtime=JSON.parse(fs.readFileSync(path.join(repo,'output/phase3/localhost-run-injection-v01/runtime-pins.json'),'utf8').replace(/^\uFEFF/,''));
// Pin all executable/config assets in installed runtime packages actually imported by this batch.
const resolveServer=createRequire(path.join(repo,'server/package.json'));
function packageFile(from,name){for(const dir of from.resolve.paths(name)||[]){const candidate=path.join(dir,name,'package.json');if(fs.existsSync(candidate))return candidate;}throw Error('INSTALLED_DEPENDENCY_MISSING: '+name);}
const roots=[],packages=new Set();function dependencies(pkg){pkg=fs.realpathSync(pkg);if(packages.has(pkg))return;packages.add(pkg);roots.push(path.dirname(pkg));const metadata=JSON.parse(fs.readFileSync(pkg,'utf8')),from=createRequire(pkg);for(const name of Object.keys({...metadata.dependencies,...metadata.optionalDependencies})){try{dependencies(packageFile(from,name));}catch(e){if(!(name in (metadata.optionalDependencies||{})))throw e;}}}
for(const p of ['tsx','@prisma/adapter-pg','@prisma/client','express','express-rate-limit','pg','dotenv','zod','jsonwebtoken'])dependencies(packageFile(resolveServer,p));
const pw=path.dirname(path.dirname(runtime.find(p=>p.path.endsWith('playwright\\package.json')).path));roots.push(path.join(pw,'playwright'),path.join(pw,'playwright-core'));
const runtimeFiles=new Set(runtime.map(p=>p.path));for(const root of roots)for(const p of walk(root))if(/\.(?:c?js|mjs|json|node|exe|wasm)$/.test(p))runtimeFiles.add(p);
runtimeFiles.add('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
fs.writeFileSync(path.join(base,'runtime-pins.json'),JSON.stringify([...runtimeFiles].sort().map(p=>({path:p,sha256:hash(p)})),null,2));
const source=[...walk(path.join(repo,'server/src')).filter(p=>p.endsWith('.ts')),...walk(path.join(repo,'server/test/phase3-genuine')),
...walk(path.join(repo,'server/prisma/migrations')).filter(p=>p.endsWith('.sql')),
...['server/test/phase3-genuine-harness.test.ts','server/test/phase3-http.test.ts','server/test/phase3-gateway.vitest.config.ts','server/test/phase3-proof-diagnostics.ts','server/prisma/schema.prisma','server/package.json','server/pnpm-lock.yaml','server/package-lock.json','docs/proposals/PHASE_3_FINAL_GATES.md'].map(p=>path.join(repo,p)),
...['fixture-plan.json','runtime-pins.json','REVIEW.md','verify-contract.cjs','verify-lint.cjs','verify-sql.cjs','build-pins.cjs'].map(p=>path.join(base,p)),
...['localhost-run-injection-v01/transport.cjs','localhost-run-smoke/transport.cjs','localhost-run-smoke/known_hosts','localhost-run-smoke/ssh-environment.cjs','localhost-run-smoke-v03/discovery.cjs','localhost-run-smoke-v03/ssh-lifecycle.cjs','localhost-run-proxy-v01/proxy-evidence.cjs','isolated-callback/boundary.cjs'].map(p=>path.join(repo,'output/phase3',p))];
const pins=[...new Set(source)].sort().map(p=>({path:path.relative(base,p),sha256:hash(p)}));fs.writeFileSync(path.join(base,'pins.json'),JSON.stringify(pins,null,2));
const caller=path.join(base,'Invoke-GenuineSandbox.ps1'),text=fs.readFileSync(caller,'utf8');fs.writeFileSync(caller,text.replace(/'MANIFEST_HASH'|(?<=\.Hash -cne )'[A-F0-9]{64}'/,`'${hash(path.join(base,'pins.json'))}'`));
console.log(JSON.stringify({sourcePins:pins.length,runtimePins:runtimeFiles.size,callerSHA256:hash(caller)}));
