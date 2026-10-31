import {createRequire} from 'node:module';
import {createServer, request} from 'node:http';
import express from 'express';
import type {ProtectedAuthServices} from '../src/services/protected-auth.service.js';
import type {createCompatibleOutboxWorker} from '../src/services/compatible-outbox.service.js';

/** Private proof-process composition only. Do not discover .env, construct the
 * default Prisma client, mount production routes or enable SMTP. Actual selected
 * controllers/workers execute; persistence is supplied by the restricted proof.
 * Refuse a process which already loaded any overridden application boundary.
 */
export function loadSyntheticApplication(approved: boolean) {
  if (approved !== true) throw new Error('PHASE1_APPLICATION_APPROVAL_REQUIRED');
  const local = createRequire(__filename), before = new Set(Object.keys(local.cache));
  const overrides = ['../src/config/env.js','../src/lib/prisma.js','../src/services/auth.service.js'].map(name => local.resolve(name));
  if (overrides.some(id => local.cache[id])) throw new Error('PHASE1_APPLICATION_ALREADY_LOADED');
  const forbidden = () => {throw new Error('PHASE1_DEFAULT_PERSISTENCE_FORBIDDEN');};
  const exports = [{env: Object.freeze({nodeEnv: 'test', emailDeliveryEnabled: false,
    corsOrigins: ['https://synthetic.example.invalid'], accessTokenCookieMaxAgeMs: 900000, refreshTokenExpiresDays: 1})},
  {prisma: new Proxy({}, {get: forbidden})}, Object.freeze({})];
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    // This helper owns only modules loaded in this isolated test process scope.
    for (const id of Object.keys(local.cache)) if (!before.has(id) && (overrides.includes(id) || /[/\\]server[/\\]src[/\\]/.test(id))) delete local.cache[id];
  };
  try {
    overrides.forEach((id,index) => {local.cache[id] = {id, filename:id, loaded:true, exports:exports[index], children:[], paths:[]} as unknown as NodeModule;});
    const {createProtectedAuthController} = local('../src/controllers/auth.controller.js') as typeof import('../src/controllers/auth.controller.js');
    const {createCompatibleOutboxWorker} = local('../src/services/compatible-outbox.service.js') as typeof import('../src/services/compatible-outbox.service.js');
    const {protectRequestOrigin} = local('../src/middleware/request-origin.js') as typeof import('../src/middleware/request-origin.js');
    const {errorHandler} = local('../src/middleware/error-handler.js') as typeof import('../src/middleware/error-handler.js');
    return {
      worker: createCompatibleOutboxWorker,
      async replay(service: ProtectedAuthServices, input: {email:string;password:string;name:null}, requestId: string): Promise<void> {
        if (closed) throw new Error('PHASE1_APPLICATION_CLOSED');
        const app = express(), controller = createProtectedAuthController(service);
        app.use(express.json({limit:'2kb'}), protectRequestOrigin); app.post('/register', controller.register); app.use(errorHandler);
        const server = createServer(app);
        try {
          await new Promise<void>((resolve,reject) => {server.once('error',reject); server.listen(0,'127.0.0.1',resolve);});
          const address = server.address(); if (!address || typeof address === 'string') throw new Error('PHASE1_APPLICATION_LISTENER_FAILED');
          const send = (body: unknown, key: string | null, origin = 'https://synthetic.example.invalid') => new Promise<{status:number;cookies:unknown;cache:unknown;body:string}>((resolve,reject) => {
            const data=JSON.stringify(body), req=request({host:'127.0.0.1',port:address.port,path:'/register',method:'POST',
              headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),Origin:origin,...(key?{'Idempotency-Key':key}:{})}},res=>{
              let output=''; res.setEncoding('utf8'); res.on('data',chunk=>{output+=chunk;if(output.length>4096)res.destroy(new Error('PHASE1_APPLICATION_RESPONSE_LIMIT'));});
              res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode??0,cookies:res.headers['set-cookie'],cache:res.headers['cache-control'],body:output}));
            });
            req.setTimeout(3000,()=>req.destroy(new Error('PHASE1_APPLICATION_REQUEST_TIMEOUT')));req.on('error',reject);req.end(data);
          });
          // The receipt canonical form uses name:null, but the public validator
          // accepts an omitted optional name, not JSON null. Preserve both contracts.
          const body={email:input.email,password:input.password};
          const replay=await send(body,requestId);
          if(replay.status!==200||replay.cookies!==undefined||replay.cache!=='no-store'||!replay.body.includes('"registration":"replayed"')||!replay.body.includes('"requiresSignIn":true')||
            /accessToken|refreshToken|password|credentialId|jobId/.test(replay.body)) throw new Error('PHASE1_APPLICATION_REPLAY_FAILED');
          if((await send({...body,password:input.password+'Changed'},requestId)).status!==409 || (await send(body,null)).status!==400 ||
            (await send(body,requestId,'https://untrusted.example.invalid')).status!==403) throw new Error('PHASE1_APPLICATION_BOUNDARY_FAILED');
        } finally {
          server.closeAllConnections(); if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
        }
      },
      close,
    };
  } catch {close();throw new Error('PHASE1_APPLICATION_LOAD_FAILED');}
}

export type SyntheticApplication = ReturnType<typeof loadSyntheticApplication>;
export type SyntheticWorkerComposition = Parameters<typeof createCompatibleOutboxWorker>[0];
