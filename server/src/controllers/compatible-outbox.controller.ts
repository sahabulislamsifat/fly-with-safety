import type { Request,Response,NextFunction } from 'express';
import type { createCompatibleOutboxWorker } from '../services/compatible-outbox.service.js';
import { AppError, isAppError } from '../utils/errors.js';
import { success } from '../utils/response.js';

export interface VerifiedWorkerIdentity {workerId:string}
export interface VerifiedOperatorIdentity {operatorId:string}
/** Does not mount routes. Trusted identity resolvers must reuse verified worker/admin admission. */
export function createCompatibleOutboxController(input:{
  worker:ReturnType<typeof createCompatibleOutboxWorker>;
  admitWorker(req:Request):Promise<VerifiedWorkerIdentity|null>;
  admitOperator(req:Request):Promise<VerifiedOperatorIdentity|null>;
}){
  return {
    async run(req:Request,res:Response,next:NextFunction):Promise<void>{
      res.set('Cache-Control','no-store, private');
      try{
        if(req.method!=='GET')throw new AppError('Worker requires GET.',405,'METHOD_NOT_ALLOWED');
        if(req.get('Origin')!==undefined||req.get('Sec-Fetch-Site')!==undefined)throw AppError.forbidden('Worker admission denied.');
        const identity=await input.admitWorker(req);if(!identity)throw AppError.unauthorized('Worker admission denied.');
        // Limit and dispatch deadline belong to the worker, never query/body parameters.
        res.json(success(await input.worker.run(identity.workerId)));
      }catch(error){if(isAppError(error))next(error);else next(AppError.internal());}
    },
    async redrive(req:Request,res:Response,next:NextFunction):Promise<void>{
      res.set('Cache-Control','no-store, private');
      try{
        if(req.method!=='POST')throw new AppError('Redrive requires POST.',405,'METHOD_NOT_ALLOWED');
        const identity=await input.admitOperator(req);if(!identity)throw AppError.forbidden('Operator admission denied.');
        const body:unknown=req.body;
        if(!body||typeof body!=='object'||!('source'in body)||body.source!=='ordinary'||
          !('version'in body)||typeof body.version!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(body.version))throw AppError.badRequest('An ordinary record and exact version are required.');
        if(!await input.worker.redrive('ordinary',req.params.id,body.version,identity.operatorId))throw AppError.conflict('Notification cannot be safely redriven.');
        res.json(success({id:req.params.id,status:'PENDING'}));
      }catch(error){if(isAppError(error))next(error);else next(AppError.internal());}
    },
  };
}
