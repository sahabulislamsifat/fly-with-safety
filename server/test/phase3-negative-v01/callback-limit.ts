import {rateLimit} from 'express-rate-limit';
import type {RequestHandler} from 'express';

/** Isolated runtime only. Admission set is populated by the unchanged exact
 * Host/HTTPS/path/body/loopback ingress guard, never a client-supplied header.
 * All admitted requests share one conservative run bucket. No proxy IP is trusted.
 * This component is prepared for the continuation; production router is unchanged.
 */
export function createIsolatedCallbackLimiter(admitted:WeakSet<object>,limit=60):RequestHandler {
 const limiter=rateLimit({windowMs:60000,limit,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:()=> 'isolated-callback-budget'});
 return(req,res,next)=>{
  if(!admitted.has(req)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||req.app.get('trust proxy')!==false){res.status(404).end();return;}
  return limiter(req,res,next);
 };
}
