// Normal main development restoration; never imported by callback probe.
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(process.cwd(),'../output/phase3/callback-tunnel-20261103-06/normal-restore');
async function main(){
 process.env.NODE_ENV='development';process.env.PORT='5000';
 process.env.SSLCOMMERZ_ENABLED='false';process.env.EMAIL_DELIVERY_ENABLED='false';
 process.argv.push('--no-outbox-worker');
 await import('../../../server/src/config/env.js');
 const u=new URL(process.env.DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname.endsWith('.prisma.io')||u.pathname!=='/postgres')throw Error('NORMAL_MAIN_CONFIG_REQUIRED');
 const {prisma}=await import('../../../server/src/lib/prisma.js');
 const identity=await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');return tx.$queryRawUnsafe<Array<{db:string;role:string}>>('SELECT current_database() AS db,current_user AS role');},{maxWait:5000,timeout:10000});
 if(identity[0]?.db!=='postgres'||identity[0]?.role!=='prisma_migration')throw Error('MAIN_IDENTITY_MISMATCH');
 fs.writeFileSync(path.join(base,'backend-config.json'),JSON.stringify({pid:process.pid,mainFromNormalServerEnv:true,readonlyIdentityPass:true,localIntegration:false,payments:false,notificationDelivery:false,worker:false,merchantSecretInspected:false}),{flag:'wx'});
 await import('../../../server/src/server.js');
 process.on('message',m=>{if((m as {action?:string})?.action==='stop-owned-development-server')process.emit('SIGTERM','SIGTERM');});
}
main().catch((error:unknown)=>{const e=error as {code?:string;meta?:{code?:string}};fs.writeFileSync(path.join(base,'backend-error.json'),JSON.stringify({code:typeof e.code==='string'&&/^(?:P\d{4}|ERR_[A-Z_]+|ENOTFOUND|ECONNREFUSED|ETIMEDOUT)$/.test(e.code)?e.code:null,sqlState:typeof e.meta?.code==='string'&&/^[A-Z0-9]{5}$/.test(e.meta.code)?e.meta.code:null}),{flag:'wx'});console.error('NORMAL_BACKEND_RESTORE_FAILED_SANITIZED');process.exit(1);});
