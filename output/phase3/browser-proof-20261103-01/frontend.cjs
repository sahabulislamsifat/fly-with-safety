const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const dir=path.resolve(__dirname,'../../../client'),local=createRequire(path.join(dir,'package.json'));
process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL='http://localhost:5000/api/v1';
process.env.NEXT_PUBLIC_API_BASE_URL='http://localhost:5000/api/v1';
(async()=>{
 const original=(await import(pathToFileURL(path.join(dir,'next.config.ts')).href)).default;
 const app=local('next')({dev:true,dir,hostname:'localhost',port:3000,conf:{...original,distDir:'.next-phase3-browser',env:{...original.env,NEXT_PUBLIC_LOCAL_API_BASE_URL:'http://localhost:5000/api/v1',NEXT_PUBLIC_API_BASE_URL:'http://localhost:5000/api/v1'}}});
 await app.prepare();
 const server=require('node:http').createServer(app.getRequestHandler());
 server.listen(3000,'localhost',()=>{
  const data={ready:true,pid:process.pid,frontend:'http://localhost:3000',api:'http://localhost:5000/api/v1',cloudFallbackDisabled:true,processLocalConfiguration:true,normalEnvChanged:false};
  fs.writeFileSync(path.join(__dirname,'frontend-ready.json'),JSON.stringify(data,null,2),{flag:'wx'});console.log('PHASE3_LOCAL_ONLY_FRONTEND_READY_3000');
 });
 server.on('error',()=>{console.error('PHASE3_FRONTEND_BIND_FAILED_NO_PROCESS_TERMINATION');process.exitCode=1;void app.close();});
})().catch(()=>{console.error('PHASE3_FRONTEND_PREPARATION_FAILED');process.exitCode=1});
