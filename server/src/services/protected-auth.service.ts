import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { issueProtectedCredential, prepareProtectedIssuance, revokeProtectedCredentials, type AccountBinding, type ProtectedAuthStore, type Purpose } from '../security/protected-auth.js';
import { executeIssuanceRequest, isIssuanceRequestConflict, IssuanceRequestConflict, type IssuanceStore, type RecoveryAdmission } from '../security/issuance-replay.js';
import type { LogicalDigestPolicy } from '../security/idempotency-digest.js';
import type { EnvelopeKeys } from '../security/protected-envelope.js';
import type { AuthSession, AuthUser } from './auth.service.js';
import { registerSchema, emailSchema, resetPasswordSchema, tokenSchema } from '../validators/auth.schemas.js';
import { AppError } from '../utils/errors.js';

export interface ProtectedAuthServiceStore extends ProtectedAuthStore {
  lookupAccount(email: string): Promise<(AccountBinding & { emailVerified: boolean }) | null>;
  lookupCredential(digest: string, purpose: Purpose): Promise<{ id: string } | null>;
  consume(id: string, digest: string, purpose: Purpose, passwordHash?: string): Promise<boolean>;
}
export interface ProtectedAuthServices {
  register(input: unknown): Promise<AuthSession>;
  resendVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  resetPassword(input: unknown): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  registerRequest(input:unknown,requestId:string):Promise<{status:'created';session:AuthSession}|{status:'replayed'}>;
  requestPasswordResetOnce(email:string,requestId:string):Promise<void>;
  resendVerificationOnce(email:string,requestId:string):Promise<void>;
}
export interface ProtectedAuthComposition {
  store: ProtectedAuthServiceStore;
  keys: EnvelopeKeys;
  keyRef: string;
  refreshTokenExpiresDays: number;
  recovery: RecoveryAdmission;
  requests?: {store:IssuanceStore;policy:LogicalDigestPolicy};
  /** Trusted signing composition; called before registration commits, never from request/job data. */
  signAccessToken(user: AuthUser, sessionId: string): string;
}

/** Explicit composition only: no env discovery, route replacement, DB constructor or legacy fallback. */
export function createProtectedAuthServices(deps: ProtectedAuthComposition): ProtectedAuthServices {
  if (!deps || !Number.isInteger(deps.refreshTokenExpiresDays) || deps.refreshTokenExpiresDays < 1 ||
      deps.refreshTokenExpiresDays > 365 || !/^[A-Za-z0-9_-]{1,64}$/.test(deps.keyRef) || typeof deps.signAccessToken !== 'function'||!deps.recovery) throw AppError.internal();
  const {store,keys,keyRef,refreshTokenExpiresDays,signAccessToken,recovery,requests}=deps;
  const admit=async(action:'issue'|'consume')=>{if(await recovery.admit(action)!==true)throw AppError.internal();};
  const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
  const normalized=(email:string)=>emailSchema.parse({email:email.trim().toLowerCase()}).email;
  async function issue(email: string, purpose: Purpose): Promise<void> {
    if(requests)throw AppError.badRequest('Issuance request identifier required.');
    try {
      await admit('issue');
      const account=await store.lookupAccount(normalized(email));
      if (!account || purpose==='verification' && account.emailVerified) return;
      await issueProtectedCredential(store,keys,keyRef,account,purpose,new Date(Date.now()+(purpose==='reset'?1:24)*3600000));
    } catch { throw AppError.internal(); }
  }
  async function consume(token: string, purpose: Purpose, passwordHash?: string): Promise<void> {
    const invalid=AppError.badRequest(purpose==='reset'?'This password reset link is invalid or expired.':'This verification link is invalid or expired.');
    try {
      await admit('consume');
      const digest=hash(tokenSchema.parse({token}).token),record=await store.lookupCredential(digest,purpose);
      if (!record || !await store.consume(record.id,digest,purpose,passwordHash)) throw invalid;
    } catch(error) { if(error===invalid)throw invalid;throw AppError.internal(); }
  }
  async function issueOnce(emailInput:string,purpose:Purpose,requestId:string):Promise<void>{
    try{
      if(!requests)throw AppError.internal();const email=normalized(emailInput);
      await executeIssuanceRequest(requests.store,requests.policy,recovery,requestId,purpose,{email},async()=>{
        const account=await store.lookupAccount(email);
        if(!account||purpose==='verification'&&account.emailVerified)return {
          receipt:{operation:purpose,userId:null,credentialId:null,jobId:null,sessionId:null},value:undefined,apply:async()=>{},
        };
        const prepared=await prepareProtectedIssuance(keys,keyRef,account,purpose,new Date(Date.now()+(purpose==='reset'?1:24)*3600000));
        return {receipt:{operation:purpose,userId:account.userId,credentialId:prepared.credentialId,jobId:prepared.jobId,sessionId:null},value:undefined,apply:prepared.apply};
      });
    }catch(error){if(isIssuanceRequestConflict(error))throw AppError.conflict('Issuance request identifier was already used with different input.');throw AppError.internal();}
  }
  return {
    async register(input) {
      if(requests)throw AppError.badRequest('Issuance request identifier required.');
      const parsed=registerSchema.safeParse(input);
      if(!parsed.success)throw AppError.badRequest('Invalid registration details.');
      const data=parsed.data,email=normalized(data.email);
      const conflict=AppError.conflict('An account with this email already exists');
      try {
        await admit('issue');
        if(await store.lookupAccount(email))throw conflict;
        const user:AuthUser=Object.freeze({id:randomUUID(),email,name:data.name?.trim()||null,role:'CUSTOMER',emailVerified:false});
        const passwordHash=await bcrypt.hash(data.password,12),sessionId=randomUUID(),refreshToken=randomBytes(48).toString('base64url');
        const accessToken=signAccessToken(user,sessionId);
        if(typeof accessToken!=='string'||!accessToken)throw AppError.internal();
        await issueProtectedCredential(store,keys,keyRef,{userId:user.id,generation:0,recipient:email},'verification',new Date(Date.now()+24*3600000),
          {passwordHash,name:user.name,sessionId,sessionDigest:hash(refreshToken),sessionExpiresAt:new Date(Date.now()+refreshTokenExpiresDays*86400000)});
        return {user,accessToken,refreshToken};
      } catch(error) { if(error===conflict)throw conflict;throw AppError.internal(); }
    },
    resendVerification:email=>issue(email,'verification'),
    requestPasswordReset:email=>issue(email,'reset'),
    verifyEmail:token=>consume(token,'verification'),
    async resetPassword(input){const parsed=resetPasswordSchema.safeParse(input);if(!parsed.success)throw AppError.badRequest('Invalid password reset details.');
      let passwordHash:string;try{passwordHash=await bcrypt.hash(parsed.data.password,12);}catch{throw AppError.internal();}
      await consume(parsed.data.token,'reset',passwordHash);
    },
    async revokeUserSessions(userId){try{await admit('consume');await revokeProtectedCredentials(store,userId);}catch{throw AppError.internal();}},
    requestPasswordResetOnce:(email,id)=>issueOnce(email,'reset',id),
    resendVerificationOnce:(email,id)=>issueOnce(email,'verification',id),
    async registerRequest(input,requestId){
      const parsed=registerSchema.safeParse(input);if(!parsed.success)throw AppError.badRequest('Invalid registration details.');
      try{
        if(!requests)throw AppError.internal();const data=parsed.data,email=normalized(data.email);
        const result=await executeIssuanceRequest<AuthSession>(requests.store,requests.policy,recovery,requestId,'register',{email,password:data.password,name:data.name?.trim()||null},async()=>{
          if(await store.lookupAccount(email))throw new IssuanceRequestConflict();
          const user:AuthUser=Object.freeze({id:randomUUID(),email,name:data.name?.trim()||null,role:'CUSTOMER',emailVerified:false});
          const passwordHash=await bcrypt.hash(data.password,12),sessionId=randomUUID(),refreshToken=randomBytes(48).toString('base64url');
          const accessToken=signAccessToken(user,sessionId);if(typeof accessToken!=='string'||!accessToken)throw AppError.internal();
          const prepared=await prepareProtectedIssuance(keys,keyRef,{userId:user.id,generation:0,recipient:email},'verification',new Date(Date.now()+24*3600000),
            {passwordHash,name:user.name,sessionId,sessionDigest:hash(refreshToken),sessionExpiresAt:new Date(Date.now()+refreshTokenExpiresDays*86400000)});
          return {receipt:{operation:'register',userId:user.id,credentialId:prepared.credentialId,jobId:prepared.jobId,sessionId},value:{user,accessToken,refreshToken},apply:prepared.apply};
        });
        return result.replayed?{status:'replayed'}:{status:'created',session:result.value};
      }catch(error){if(isIssuanceRequestConflict(error))throw AppError.conflict('Registration request conflicts with an existing request or account.');throw AppError.internal();}
    },
  };
}
