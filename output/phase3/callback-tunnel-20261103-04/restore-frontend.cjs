'use strict';
const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module');
const dir=path.resolve(__dirname,'../../../client'),local=createRequire(path.join(dir,'package.json'));
process.env.NODE_ENV='development';process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL='http://localhost:5000/api/v1';process.env.NEXT_PUBLIC_API_BASE_URL='http://localhost:5000/api/v1';
(async()=>{const app=local('next')({dev:true,dir,hostname:'localhost',port:3000});await app.prepare();const server=require('node:http').createServer(app.getRequestHandler());
 server.on('error',()=>{console.error('NORMAL_FRONTEND_RESTORE_BIND_FAILED');process.exitCode=1;void app.close();});
 server.listen(3000,'localhost',()=>{fs.writeFileSync(path.join(__dirname,'normal-restore/frontend-config.json'),JSON.stringify({pid:process.pid,localAPI:'http://localhost:5000/api/v1',cloudFallbackDisabled:true}),{flag:'wx'});console.log('NORMAL_FRONTEND_RESTORED_3000');});
 process.on('message',async m=>{if(m?.action!=='stop-owned-development-server')return;server.closeAllConnections();await new Promise(r=>server.close(r));await app.close();process.exit(0);});
})().catch(()=>{console.error('NORMAL_FRONTEND_RESTORE_FAILED_SANITIZED');process.exit(1);});
