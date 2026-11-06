/** Owner-approved sandbox only. No dotenv, normal server, jobs, or public startup. */
import express, { type Response } from 'express';

const { boundary, assertTarget } = require('../../output/phase3/isolated-callback/boundary.cjs');
export async function startPaymentCallbackRuntime() {
 if(process.env.PHASE3_GENUINE_SANDBOX_APPROVED!=='true')throw Error('SEPARATE_PROVIDER_APPROVAL_REQUIRED');
 assertTarget(process.env.DATABASE_URL);
 if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('LOCAL_URL_PARITY_REQUIRED');
 if(process.env.SSLCOMMERZ_CALLBACK_BASE_URL!=='https://russel-semisacred-elise.ngrok-free.dev'||process.env.FRONTEND_URL!=='http://localhost:3000')throw Error('ORIGIN_MISMATCH');
 const {prisma}=await import('../src/lib/prisma.js');
 try {
 const rows=await prisma.$queryRawUnsafe<Array<{db:string;role:string;oid:number;port:number;host:string}>>('SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,inet_server_port() AS port,host(inet_server_addr()) AS host');
 if(rows.length!==1||rows[0].db!=='flywithsafety_local_integration'||rows[0].role!=='flywithsafe_phase2_booking_test'||rows[0].oid!==34701||rows[0].port!==5432||rows[0].host!=='127.0.0.1')throw Error('LIVE_LOCAL_IDENTITY_MISMATCH');
 const {gatewayConfig}=await import('../src/payments/sslcommerz.js');gatewayConfig();
 const {paymentCallbacks}=await import('../src/payments/payment.routes.js');
 const app=express();app.disable('x-powered-by');app.use(boundary);app.use('/api/v1',paymentCallbacks);
 app.use((_req:unknown,res:Response)=>res.sendStatus(404));
 app.use((_err:unknown,_req:unknown,res:Response,_next:unknown)=>res.status(400).json({error:'CALLBACK_REJECTED'}));
 const server=await new Promise<import('node:http').Server>((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
 return {server,close:async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await prisma.$disconnect();}};
 }catch(e){await prisma.$disconnect();throw e;}
}
