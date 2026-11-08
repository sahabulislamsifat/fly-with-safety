'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'output/phase5/p5-browser-preparation-20261108-01');
async function main(){
const local=createRequire(path.join(repo,'client/eslint.config.mjs')),{ESLint}=local('eslint');
const tsEslint=createRequire(local.resolve('eslint-config-next'))('typescript-eslint');
const eslint=new ESLint({cwd:repo,overrideConfigFile:true,overrideConfig:[...tsEslint.configs.recommended,{files:['**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}},{rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}}]});
const lint=await eslint.lintFiles(['server/test/p5-browser-acceptance/*.cjs','server/test/p5-browser-acceptance/*.ts']);
const result={files:lint.length,errors:lint.reduce((n,r)=>n+r.errorCount,0),warnings:lint.reduce((n,r)=>n+r.warningCount,0),findings:lint.filter(r=>r.messages.length).map(r=>({file:path.relative(repo,r.filePath),messages:r.messages}))};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'lint.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.errors||result.warnings)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
