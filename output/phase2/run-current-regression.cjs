const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),server=path.join(root,'server'),results=[];
const configs=['phase2-commercial.vitest.config.ts','phase2-booking-foundation.vitest.config.ts','phase2-booking-regression.vitest.config.ts','phase2-booking.pg.vitest.config.ts'];
const env={...process.env};
for(const name of ['DATABASE_URL','DIRECT_URL','PGPASSWORD','PHASE2_BOOKING_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_BOOKING_LEDGER','PHASE2_SYNTHETIC_PASSWORD'])delete env[name];
for(const loader of ['bundle','native']) for(const config of configs){
 const name=`current-${loader}-${config.replace('.vitest.config.ts','')}`;
 const args=[path.join(server,'node_modules/vitest/vitest.mjs'),'run','--config',path.join(server,'test',config),'--reporter=json','--outputFile='+path.join(__dirname,name+'.json')];
 if(loader==='native')args.push('--configLoader','native');
 const child=spawnSync(process.execPath,args,{cwd:server,env,encoding:'utf8',timeout:90000,windowsHide:true});
 fs.writeFileSync(path.join(__dirname,name+'.log'),(child.stdout||'')+(child.stderr||''));
 const reportPath=path.join(__dirname,name+'.json');
 const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{};
 const row={loader,config,exit:child.status,passed:report.numPassedTests||0,failed:report.numFailedTests||0,skipped:report.numPendingTests||0};results.push(row);console.log(JSON.stringify(row));
 if(child.status!==0){fs.writeFileSync(path.join(__dirname,'current-regression.json'),JSON.stringify({passed:false,results},null,2));process.exit(1);}
}
fs.writeFileSync(path.join(__dirname,'current-regression.json'),JSON.stringify({passed:true,finishedUTC:new Date().toISOString(),realDatabaseExecution:false,results},null,2));
