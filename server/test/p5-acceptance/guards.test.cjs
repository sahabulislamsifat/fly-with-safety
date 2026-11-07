'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('../../node_modules/typescript');
// Load only pure test-support exports. Prisma/Playwright imports are type-only and erased.
const filename=path.join(__dirname,'four-role-api.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const isolated=new Module(filename,module);isolated.filename=filename;isolated.paths=module.paths;isolated._compile(compiled,filename);
const {isolatedOrigin}=isolated.exports;
test('explicit loopback test API origin accepted',()=>assert.equal(isolatedOrigin('http://127.0.0.1:38191/api/v1'),'http://127.0.0.1:38191'));
for(const value of ['https://production.example/api/v1','http://127.0.0.1:3000','http://127.0.0.1:5000','http://127.0.0.1:5432','http://private:secret@127.0.0.1:38191','http://127.0.0.1:38191/?credential=synthetic','http://127.0.0.1:38191/#synthetic'])test('test-scope origin rejection '+new URL(value).host,()=>assert.throws(()=>isolatedOrigin(value)));
