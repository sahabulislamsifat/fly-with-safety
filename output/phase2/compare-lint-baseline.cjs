const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),current=JSON.parse(fs.readFileSync(path.join(__dirname,'lint-current.json'),'utf8'));
const results=[];let introducedErrors=0,introducedWarnings=0;
for(const row of current.filter(row=>row.messages.length)){
 const relative=path.relative(root,row.filePath).replaceAll('\\','/');
 const previous=spawnSync('git',['show','HEAD:'+relative],{cwd:root,encoding:'utf8'});assert.equal(previous.status,0);
 const lint=spawnSync(process.execPath,[path.join(root,'client/node_modules/eslint/bin/eslint.js'),'--config',path.join(root,'client/eslint.config.mjs'),'--stdin','--stdin-filename',row.filePath,'--format','json'],{cwd:root,encoding:'utf8',input:previous.stdout,timeout:60000,windowsHide:true});
 assert([0,1].includes(lint.status));const baseline=JSON.parse(lint.stdout)[0];
 const oldLines=previous.stdout.split(/\r?\n/),newLines=fs.readFileSync(row.filePath,'utf8').split(/\r?\n/);
 const key=(m,lines)=>JSON.stringify([m.ruleId,m.severity,lines[m.line-1]?.trim()]);
 const counts=new Map();for(const message of baseline.messages){const k=key(message,oldLines);counts.set(k,(counts.get(k)||0)+1);}
 for(const message of row.messages){const k=key(message,newLines),n=counts.get(k)||0;if(n)counts.set(k,n-1);else if(message.severity===2)introducedErrors++;else introducedWarnings++;}
 results.push({file:relative,currentErrors:row.errorCount,currentWarnings:row.warningCount,baselineErrors:baseline.errorCount,baselineWarnings:baseline.warningCount});
}
const result={passed:!introducedErrors&&!introducedWarnings,introducedErrors,introducedWarnings,results};
fs.writeFileSync(path.join(__dirname,'lint-baseline-disposition.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(!result.passed)process.exitCode=1;
