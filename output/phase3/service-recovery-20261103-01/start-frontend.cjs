'use strict';
const fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process');
if(fs.existsSync(path.join(__dirname,'frontend-started.json')))throw Error('EXISTING_FRONTEND_RECOVERY_INSPECT_FIRST');
let oldAlive=false;try{process.kill(4440,0);oldAlive=true;}catch(e){if(e.code!=='ESRCH')throw e;}
if(oldAlive)throw Error('OLD_FRONTEND_STILL_ALIVE_NO_DUPLICATE_START');
const env=Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const p=fork(path.join(__dirname,'frontend.cjs'),[],{cwd:path.resolve(__dirname,'../../../client'),env,execArgv:[],windowsHide:true,silent:true});
fs.writeFileSync(path.join(__dirname,'frontend-started.json'),JSON.stringify({supervisor:process.pid,frontend:p.pid,oldFrontendGone:true}),{flag:'wx'});
p.stdout.on('data',data=>{if(data.toString().includes('NORMAL_FRONTEND_RESTORED_3000'))console.log('NORMAL_FRONTEND_RESTORED_3000');});p.stderr.on('data',()=>{});
p.on('exit',(code,signal)=>{fs.writeFileSync(path.join(__dirname,'frontend-exit.json'),JSON.stringify({pid:p.pid,code,signal}),{flag:'wx'});console.log('OWNED_FRONTEND_EXIT '+code);});
const timer=setInterval(()=>{if(!fs.existsSync(path.join(__dirname,'stop-frontend.request.json')))return;clearInterval(timer);if(p.connected)p.send({action:'stop-owned-development-server'});},1000);
