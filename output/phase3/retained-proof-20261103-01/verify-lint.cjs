const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),local=createRequire(path.join(root,'client/eslint.config.mjs'));
const {ESLint}=local('eslint'),ts=createRequire(local.resolve('eslint-config-next'))('typescript-eslint');
(async()=>{
 const lint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:ts.configs.recommended});
 const files=await lint.lintFiles(['server/test/phase3-ledger.pg.integration.ts','server/test/phase3-retained-fixtures.ts','server/test/phase3-retained-fixtures.test.ts']);
 const report={errors:files.reduce((n,r)=>n+r.errorCount,0),warnings:files.reduce((n,r)=>n+r.warningCount,0),files:files.map(r=>({path:path.relative(root,r.filePath),messages:r.messages}))};
 fs.writeFileSync(path.join(__dirname,'eslint.json'),JSON.stringify(report,null,2));console.log(report);process.exitCode=report.errors||report.warnings?1:0;
})().catch(e=>{console.error(e.message);process.exitCode=1});
