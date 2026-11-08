'use strict';
// Offline sealing only; never imports the application or connects to a database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'output/phase5/p5-browser-preparation-20261108-01');fs.mkdirSync(out,{recursive:true});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase(),rel=p=>path.relative(repo,p).replaceAll('\\','/');
const files=new Map(),externals=new Map(),packages=new Set(),resolutions=[];
function add(p){p=fs.realpathSync(p);(p.toLowerCase().startsWith(repo.toLowerCase()+path.sep)?files:externals).set(p,sha(p));}
function walk(p,exclude=new Set()){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(exclude.has(e.name)||e.isSymbolicLink())continue;const f=path.join(p,e.name);if(e.isDirectory())walk(f,exclude);else if(e.isFile()&&!/^\.env(?:\.|$)/.test(e.name))add(f);}}
function pkg(p){p=fs.realpathSync(p);if(packages.has(p))return;packages.add(p);const j=JSON.parse(fs.readFileSync(path.join(p,'package.json')));walk(p,new Set(['node_modules','.git']));const r=createRequire(path.join(p,'package.json'));for(const name of new Set([...Object.keys(j.dependencies||{}),...Object.keys(j.optionalDependencies||{}),...Object.keys(j.peerDependencies||{})])){let pp;try{pp=r.resolve(name+'/package.json');}catch{for(const base of r.resolve.paths(name)||[]){const f=path.join(base,name,'package.json');if(fs.existsSync(f)){pp=f;break;}}}if(pp){const real=fs.realpathSync(pp);if(real.startsWith(repo)){resolutions.push({locator:rel(pp),entry:rel(real)});}pkg(path.dirname(real));}}}
const old=JSON.parse(fs.readFileSync(path.join(repo,'server/test/p5-integration-v04/pins.json')));
const preserved=[],drift=[];
for(const f of old.files){const p=path.join(repo,f.path);if(sha(p)===f.sha256){add(p);continue;}let snapshot;
if(f.path.startsWith('server/src/generated/prisma/'))snapshot=path.join(__dirname,'generated-before-browser',f.path.slice('server/src/generated/prisma/'.length));
if(f.path==='docs/proposals/P5_IDENTITY_SCOPE_IMPLEMENTATION_REPORT.md')snapshot=path.join(__dirname,'report-before-browser.md');
if(snapshot&&fs.existsSync(snapshot)&&sha(snapshot)===f.sha256){preserved.push({original:f.path,snapshot:rel(snapshot),sha256:f.sha256});add(snapshot);add(p);}else drift.push({path:f.path,previous:f.sha256,current:sha(p)});
}
// New implementation and acceptance sources, excluding seal products (self-reference).
walk(path.join(repo,'server/src'));walk(path.join(repo,'client/app'));walk(path.join(repo,'client/src'));walk(path.join(repo,'client/public'));
for(const e of fs.readdirSync(__dirname,{withFileTypes:true}))if(e.isFile()&&!['pins.json','Invoke-BrowserAcceptance.ps1','REVIEW.md'].includes(e.name))add(path.join(__dirname,e.name));
for(const f of ['client/next.config.ts','client/package.json','client/pnpm-lock.yaml','client/tsconfig.json','client/eslint.config.mjs','server/package.json','server/pnpm-lock.yaml','server/test/p5-disposable-target.ts','server/test/p5-setup-v06/OwnedJob.cs','output/phase5/p5-integration-20261108-02/result.json','output/phase5/p5-approved-setup-20261107-06/result.json'])add(path.join(repo,f));
for(const f of ['client/node_modules/next/package.json','client/node_modules/react/package.json','client/node_modules/react-dom/package.json','server/node_modules/vitest/package.json','server/node_modules/pg/package.json','server/node_modules/typescript/package.json'])pkg(path.dirname(fs.realpathSync(path.join(repo,f))));
const cache='C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules';pkg(path.join(cache,'playwright'));pkg(path.join(cache,'playwright-core'));
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';add(chrome);walk('C:/Program Files/Google/Chrome/Application/156.0.8078.80');
const node={path:process.execPath,sha256:sha(process.execPath)};
const manifest={scope:'PENDING_EXPLICIT_BROWSER_PERSISTENT_FIXTURE_APPROVAL',chrome,node,files:[...files].map(([p,sha256])=>({path:rel(p),sha256})).sort((a,b)=>a.path.localeCompare(b.path)),externalFiles:[...externals].map(([path,sha256])=>({path,sha256})),resolutions:old.resolutions.concat(resolutions)};
fs.writeFileSync(path.join(__dirname,'pins.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(out,'preservation.json'),JSON.stringify({preservedHistoricalFiles:old.files.length-drift.length,preservedSnapshots:preserved,expectedChangedPaths:drift,liveDatabaseConnections:0,fixtureWrites:0},null,2));
console.log(JSON.stringify({pins:files.size,externalPins:externals.size,packages:packages.size,resolutions:manifest.resolutions.length,unmappedHistoricalChanges:drift.map(x=>x.path),manifest:sha(path.join(__dirname,'pins.json'))}));
