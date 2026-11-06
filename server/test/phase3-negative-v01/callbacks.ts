import express,{Router,type RequestHandler} from 'express';
import {z} from 'zod';
import {AppError} from '../../src/utils/errors.js';
import {verifyNotification,type GatewayConfig} from '../../src/payments/sslcommerz.js';
import type {PaymentService} from '../../src/payments/payment.service.js';
/** Same provider callback contract/business service as production; only the
 * isolated limiter dependency differs. No global router/security changes. */
export function negativeCallbacks(service:()=>PaymentService,config:()=>GatewayConfig,limiter:RequestHandler){
 const router=Router(),providerId=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
 for(const source of ['success','fail','cancel','ipn'])router.post(`/payments/sslcommerz/${source}`,limiter,express.urlencoded({extended:false,limit:'16kb',parameterLimit:40}),(req,res,next)=>{void(async()=>{
 if(!req.is('application/x-www-form-urlencoded'))throw AppError.badRequest('Expected provider form data');
 const tranId=providerId.parse(req.body?.tran_id),valId=req.body?.val_id===undefined||req.body.val_id===''?undefined:providerId.parse(req.body.val_id),c=config(),s=service();
 try{verifyNotification(req.body,c.password);}catch{throw AppError.badRequest('Invalid provider notification');}
 if(req.body.store_id!==undefined&&req.body.store_id!==c.storeId)throw AppError.badRequest('Invalid provider notification');
 const booking=await s.notify(tranId,valId,source);await s.reconcile(booking);
 if(source==='ipn'){res.status(200).type('text').send('RECEIVED');return;}
 res.redirect(303,`${c.frontendOrigin}/payments/return?booking=${encodeURIComponent(booking)}`);
 })().catch(e=>next(e instanceof z.ZodError?AppError.badRequest('Invalid payment request'):e));});
 return router;
}
