import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import type { Request,Response } from 'express';
import type { Pool } from 'pg';



import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';


const mocks=vi.hoisted(()=>({boundary:false,transaction:vi.fn(),find:vi.fn(),mail:vi.fn(),enabled:true,nodeEnv:'production',legacyRegister:vi.fn(),post:vi.fn()}));
vi.mock('../src/lib/prisma.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {prisma:{$transaction:mocks.transaction,idempotencyRecord:{findUnique:mocks.find}}};});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:mocks.mail})}}));
vi.mock('../src/config/env.js',()=>({env:{get nodeEnv(){return mocks.nodeEnv;},refreshTokenExpiresDays:30,accessTokenCookieMaxAgeMs:900000,jwtSecret:'SYNTHETIC-ONLY',get emailDeliveryEnabled(){return mocks.enabled;},smtpHost:'smtp.example.invalid',smtpPort:587,smtpUser:'synthetic@example.invalid',smtpPassword:'SYNTHETIC',smtpEmailFrom:'synthetic@example.invalid',smtpEmailFromName:'Synthetic'}}));
const attempts: string[] = [];
const restore: Array<() => void> = [];
function installGuards(): void {
  const replace = (target: object, key: string, label: string) => {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value: () => {
      attempts.push(label); throw new Error('OUT04_OFFLINE_BOUNDARY');
    } });
    restore.push(() => {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    });
  };
  for (const key of ['connect', 'createConnection']) replace(net, key, `net.${key}`);
  replace(net.Socket.prototype, 'connect', 'socket.connect');
  replace(tls, 'connect', 'tls.connect');
  for (const [name, target] of [['http', http], ['https', https]] as const) {
    for (const key of ['get', 'request']) replace(target, key, `${name}.${key}`);
    replace(target.Agent.prototype, 'createConnection', `${name}.agent`);
  }
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if ((key === 'lookup' || key === 'lookupService' || key === 'reverse' || key.startsWith('resolve')) &&
          typeof Reflect.get(target, key) === 'function') replace(target, key, `dns.${key}`);
    }
  }
  replace(dgram, 'createSocket', 'udp');
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    replace(childProcess, key, `process.${key}`);
  }
  replace(globalThis, 'fetch', 'fetch');
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', 'websocket');
  syncBuiltinESMExports();
  mocks.boundary = true;

}


vi.mock('../src/services/auth.service.js',()=>({register:mocks.legacyRegister}));


let enrollment:typeof import('../src/security/enrollment-cutover.js');
let composition:typeof import('../src/services/protected-phase1.composition.js');
let authPg:typeof import('../src/security/protected-auth.pg.js');
let quarantinePg:typeof import('../src/security/notification-recovery.pg.js');
beforeAll(async()=>{installGuards();enrollment=await import('../src/security/enrollment-cutover.js');composition=await import('../src/services/protected-phase1.composition.js');authPg=await import('../src/security/protected-auth.pg.js');quarantinePg=await import('../src/security/notification-recovery.pg.js');});
afterEach(()=>{expect(attempts).toEqual([]);vi.restoreAllMocks();});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});

const schemaHash='a'.repeat(64),target={database:'flywithsafe_phase1_schema_integration',role:'phase1_test'};
function fake(){
 const state={enrolled:new Set<string>(['existing']),marked:new Set<string>(['existing']),retired:new Set<string>(),users:new Set(['a','b','existing'])};
 let backup:{enrolled:Set<string>;marked:Set<string>;retired:Set<string>}|undefined;
 const calls:Array<{sql:string;values:unknown[]}>=[],fail={sql:'',commit:false};
 const identity={database:target.database,role:target.role,session_role:target.role,host:'127.0.0.1',port:5432};
 const db={release:vi.fn(),query:vi.fn(async(sql:string,values:unknown[]=[]):Promise<{rows:Record<string,unknown>[];rowCount:number}>=>{
  calls.push({sql,values});if(fail.sql&&sql.includes(fail.sql))throw new Error('SYNTHETIC-PRIVATE');
  const id=String(values[0]);
  if(sql==='BEGIN')backup={enrolled:new Set(state.enrolled),marked:new Set(state.marked),retired:new Set(state.retired)};
  if(sql==='ROLLBACK'&&backup){state.enrolled=backup.enrolled;state.marked=backup.marked;state.retired=backup.retired;}
  if(sql==='COMMIT'){backup=undefined;if(fail.commit)throw new Error('SYNTHETIC-COMMIT-ACK');}
  if(sql.includes('current_database()'))return {rows:[identity],rowCount:1};
  if(sql.startsWith('SELECT id FROM public."User"'))return {rows:[],rowCount:state.users.has(id)?1:0};
  if(sql.startsWith('SELECT generation'))return {rows:state.enrolled.has(id)?[{legacyRetiredAt:state.marked.has(id)?'SYNTHETIC-RETIRED':null}]:[],rowCount:state.enrolled.has(id)?1:0};
  if(sql.startsWith('INSERT INTO public."AuthSecurityState"'))state.enrolled.add(id);
  if(sql.startsWith('UPDATE public."AuthSecurityState"'))state.marked.add(id);
  if(sql.startsWith('UPDATE public."Session"'))state.retired.add(id);
  return {rows:[],rowCount:1};
 })};
 const connect=vi.fn(async()=>db),store=()=>new enrollment.PostgresEnrollmentStore({connect} as never,target);
 const authorize=vi.fn(async()=>true),verify=vi.fn(async(_hash:string,_signal:AbortSignal)=>true);
 return {state,calls,fail,db,connect,identity,authorize,verify,store,
  run:(ids:readonly string[]=['a','b'])=>enrollment.enrollLegacyAccounts(store(),'operator',ids,authorize,{verify},schemaHash)};
}

describe('exact-manifest enrollment, backward compatibility and rollback',()=>{
 it('constructor is inert and confines target to separately designated local integration DB',()=>{const f=fake();f.store();expect(f.connect).not.toHaveBeenCalled();expect(()=>new enrollment.PostgresEnrollmentStore({connect:f.connect} as never,{...target,database:'flywithsafe_g3_auth02_disposable'})).toThrow('ENROLLMENT_TARGET_INVALID');});
 for(const ids of [[],['a','a'],['bad/identifier'],Array.from({length:101},(_,i)=>'u'+i),new Array(1)])it('rejects invalid manifest before connecting',async()=>{const f=fake();await expect(f.run(ids)).rejects.toThrow('ENROLLMENT_FAILED_REQUIRES_REVIEW');expect(f.connect).not.toHaveBeenCalled();});
 it('does not execute accessors or proxies',async()=>{const f=fake();let reads=0;const ids:string[]=[];Object.defineProperty(ids,'0',{get(){reads++;return 'a';}});await expect(f.run(ids)).rejects.toThrow();await expect(f.run(new Proxy(['a'],{}))).rejects.toThrow();expect(reads).toBe(0);expect(f.connect).not.toHaveBeenCalled();});
 it('operator denial prevents quiescence or DB lookup',async()=>{const f=fake();f.authorize.mockResolvedValue(false);await expect(f.run()).rejects.toThrow();expect(f.verify).not.toHaveBeenCalled();expect(f.connect).not.toHaveBeenCalled();});
 it('quiescence denial prevents writes',async()=>{const f=fake();f.verify.mockResolvedValue(false);await expect(f.run()).rejects.toThrow();expect(f.connect).not.toHaveBeenCalled();});
 it('sorts a captured manifest and never widens scope after async admission',async()=>{const f=fake(),ids=['b','a'];f.authorize.mockImplementation(async()=>{ids.push('unapproved');return true;});expect(await f.run(ids)).toEqual({enrolled:2,alreadyEnrolled:0});expect(f.calls.filter(c=>c.sql.startsWith('SELECT id FROM')).map(c=>c.values[0])).toEqual(['a','b']);});
 it('enrolls and retires links/sessions atomically without credential copying or erasure',async()=>{const f=fake();expect(await f.run()).toEqual({enrolled:2,alreadyEnrolled:0});expect(f.state.retired).toEqual(new Set(['a','b']));const sql=f.calls.map(c=>c.sql).join('\n');expect(sql).not.toMatch(/DELETE|TRUNCATE|DROP|INSERT INTO public\."ProtectedCredential"/);expect(sql).toContain('"usedAt" IS NULL');expect(sql).toContain('"revokedAt" IS NULL');expect(f.calls.at(-1)?.sql).toBe('COMMIT');expect(f.verify).toHaveBeenCalledTimes(2);});
 it('idempotent reinspection never revokes new sessions on an enrolled account',async()=>{const f=fake();expect(await f.run(['existing'])).toEqual({enrolled:0,alreadyEnrolled:1});expect(f.calls.some(c=>c.sql.startsWith('UPDATE'))).toBe(false);});
 it('existing security state without retirement marker still retires once without generation reset',async()=>{const f=fake();f.state.enrolled.add('a');expect(await f.run(['a'])).toEqual({enrolled:1,alreadyEnrolled:0});expect(f.state.marked.has('a')).toBe(true);expect(f.calls.find(c=>c.sql.startsWith('INSERT INTO public."AuthSecurityState"'))?.sql).toContain('ON CONFLICT ("userId") DO NOTHING');expect(f.calls.some(c=>c.sql.includes('generation=generation+1'))).toBe(true);expect(f.calls.some(c=>c.sql.startsWith('UPDATE public."ProtectedCredential"'))).toBe(true);expect(await f.run(['a'])).toEqual({enrolled:0,alreadyEnrolled:1});});
 it('missing exact user rolls back the whole prefix',async()=>{const f=fake();await expect(f.run(['a','missing'])).rejects.toThrow();expect(f.state.enrolled).toEqual(new Set(['existing']));expect(f.state.retired.size).toBe(0);expect(f.calls.at(-1)?.sql).toBe('ROLLBACK');});
 for(const part of ['INSERT INTO public."AuthSecurityState"','UPDATE public."EmailVerificationToken"','UPDATE public."PasswordResetToken"','UPDATE public."Session"'])it('rolls back on failure at '+part.split('"')[1],async()=>{const f=fake();f.fail.sql=part;await expect(f.run()).rejects.toThrow('ENROLLMENT_FAILED_REQUIRES_REVIEW');expect(f.state.enrolled).toEqual(new Set(['existing']));expect(f.state.retired.size).toBe(0);expect(f.calls.some(c=>c.sql==='COMMIT')).toBe(false);expect(f.connect).toHaveBeenCalledTimes(1);});
 it('lost final quiescence proof rolls back all enrollment writes',async()=>{const f=fake();f.verify.mockResolvedValueOnce(true).mockResolvedValue(false);await expect(f.run()).rejects.toThrow();expect(f.state.enrolled).toEqual(new Set(['existing']));});
 it('ambiguous COMMIT preserves possible committed state, discards client and never retries',async()=>{const f=fake();f.fail.commit=true;await expect(f.run()).rejects.toThrow();expect(f.state.enrolled.has('a')).toBe(true);expect(f.connect).toHaveBeenCalledTimes(1);expect(f.db.release).toHaveBeenCalledWith(true);expect(f.calls.filter(c=>c.sql==='COMMIT')).toHaveLength(1);});
 for(const key of ['database','role','session_role','host','port'] as const)it('rejects target mismatch before any mutation '+key,async()=>{const f=fake();Reflect.set(f.identity,key,key==='port'?5433:'mismatch');await expect(f.run()).rejects.toThrow();expect(f.calls.some(c=>/^(INSERT|UPDATE)/.test(c.sql))).toBe(false);});
 it('adapter cannot commit an incomplete retirement protocol',async()=>{const f=fake();await expect(f.store().transaction(async tx=>{await tx.lockUser('a');await tx.enroll('a');})).rejects.toThrow('ENROLLMENT_STORAGE_FAILED');expect(f.state.enrolled.has('a')).toBe(false);});
 it('retirement without enrollment is rejected',async()=>{const f=fake();await expect(f.store().transaction(async tx=>{await tx.lockUser('a');await tx.retireLegacy('a');})).rejects.toThrow();expect(f.state.retired.size).toBe(0);});
 it('connection acquisition failure cannot expose raw errors',async()=>{const connect=vi.fn(async()=>{throw new Error('SYNTHETIC-PRIVATE');});await expect(new enrollment.PostgresEnrollmentStore({connect} as never,target).transaction(async()=>{})).rejects.toThrow('ENROLLMENT_STORAGE_FAILED');expect(connect).toHaveBeenCalledTimes(1);});
});

describe('cutover admission is fresh, explicit and fails closed',()=>{
 for(const action of ['issue','consume','deliver'] as const)it('binds reviewed schema and forwards exact epoch action '+action,async()=>{const verify=vi.fn(async()=>true),admit=vi.fn(async()=>true),gate=new enrollment.CutoverAdmission({admit},{verify},schemaHash);expect(await gate.admit(action)).toBe(true);expect(verify).toHaveBeenCalledWith(schemaHash,expect.any(AbortSignal));expect(admit).toHaveBeenCalledWith(action);});
 it('denied cutover never consults epoch or caches old readiness',async()=>{const verify=vi.fn(async()=>true).mockResolvedValueOnce(true).mockResolvedValue(false),admit=vi.fn(async()=>true),gate=new enrollment.CutoverAdmission({admit},{verify},schemaHash);expect(await gate.admit('issue')).toBe(true);expect(await gate.admit('issue')).toBe(false);expect(admit).toHaveBeenCalledTimes(1);});
 it('epoch denial remains denial after successful cutover probe',async()=>{expect(await new enrollment.CutoverAdmission({admit:async()=>false},{verify:async()=>true},schemaHash).admit('consume')).toBe(false);});
 it('exceptions remain safe denial',async()=>{expect(await new enrollment.CutoverAdmission({admit:async()=>true},{verify:async()=>{throw new Error('SYNTHETIC-PRIVATE');}},schemaHash).admit('deliver')).toBe(false);});
 it('bounds hung probe and aborts instead of retrying',async()=>{let signal:AbortSignal|undefined;const verify=vi.fn(async(_h:string,s:AbortSignal)=>{signal=s;return new Promise<boolean>(()=>{});});expect(await new enrollment.CutoverAdmission({admit:async()=>true},{verify},schemaHash).admit('issue')).toBe(false);expect(signal?.aborted).toBe(true);expect(verify).toHaveBeenCalledTimes(1);});
 it('does not accept a configuration without exact reviewed schema hash',()=>{expect(()=>new enrollment.CutoverAdmission({admit:async()=>true},{verify:async()=>true},'unreviewed')).toThrow('CUTOVER_CONFIGURATION_INVALID');});
 it('future concrete rollout composition requires cutover, does not silently downgrade',()=>{expect(()=>Reflect.apply(composition.createCutoverPhase1Composition,null,[{}])).toThrow('CUTOVER_CONFIGURATION_INVALID');});
 it('concrete protected composition denies issuance and delivery before DB/key access when rollout is not ready',async()=>{
  const connect=vi.fn(async()=>{throw new Error('UNEXPECTED_CONNECTION');}),boundary=vi.fn(()=>{throw new Error('UNEXPECTED_KEY');});
  const c=composition.createCutoverPhase1Composition({pool:{connect} as never,keys:{boundary},keyRef:'synthetic',refreshTokenExpiresDays:30,
   signAccessToken:()=> 'SYNTHETIC',digestPolicy:{currentVersion:'synthetic',acquireKey:()=>Buffer.alloc(32,1)},
   recovery:{admit:async()=>true},frontendOrigin:'https://synthetic.example.invalid',authorizeDelivery:async()=>true,authorizeWorker:async()=>true,
   admitWorker:async()=>null,admitOperator:async()=>null,cutover:{probe:{verify:async()=>false},schemaHash}});
  await expect(c.auth.requestPasswordResetOnce('synthetic@example.invalid',randomUUID())).rejects.toMatchObject({statusCode:500});
  expect((await c.worker.run('synthetic-worker')).denied).toBe(1);expect(connect).not.toHaveBeenCalled();expect(boundary).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();
 });
});

describe('protected adapter enrollment contracts — fake DB protocol',()=>{
 function fixture(){const calls:string[]=[];const connection={on:vi.fn(),removeListener:vi.fn(),query:vi.fn(async(sql:string)=>{calls.push(sql);return {rows:[],rowCount:1};}),release:vi.fn()};const connect=vi.fn(async()=>connection);return {calls,connection,connect,store:()=>new authPg.PostgresProtectedAuthStore({connect} as never)};}
 for(const operation of ['lookupAccount','lookupCredential','account','consume','admit','beginSend'])it('unenrolled security state is ineligible for '+operation,async()=>{const f=fixture(),store=f.store();
  if(operation==='lookupAccount')await store.lookupAccount('synthetic@example.invalid');
  if(operation==='lookupCredential')await store.lookupCredential('a'.repeat(64),'reset');
  if(operation==='account')await store.transaction(tx=>tx.account('a'));
  if(operation==='consume')await store.consume('id','a'.repeat(64),'verification');
  if(operation==='admit')await store.admit({jobId:'job',version:1,workerId:'worker'});
  if(operation==='beginSend')await store.beginSend({jobId:'job',version:1,workerId:'worker'});
  expect(f.calls.some(sql=>sql.includes('s."legacyRetiredAt" IS NOT NULL'))).toBe(true);
 });
 it('protected registration marks only newly inserted account within same transaction',async()=>{const f=fixture();await f.store().transaction(tx=>tx.createAccount({id:'new',email:'synthetic@example.invalid',passwordHash:'SYNTHETIC-HASH',name:null}));expect(f.calls.findIndex(s=>s.startsWith('INSERT INTO public."User"'))).toBeLessThan(f.calls.findIndex(s=>s.includes('SET "legacyRetiredAt"')));expect(f.calls.at(-1)).toBe('COMMIT');});
 it('missing enrollment trigger/state rolls back protected registration',async()=>{const f=fixture();f.connection.query.mockImplementation(async sql=>{f.calls.push(sql);return {rows:[],rowCount:sql.includes('SET "legacyRetiredAt"')?0:1};});await expect(f.store().transaction(tx=>tx.createAccount({id:'new',email:'synthetic@example.invalid',passwordHash:'SYNTHETIC-HASH',name:null}))).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.calls).not.toContain('COMMIT');expect(f.calls.at(-1)).toBe('ROLLBACK');});
 it('protected acquisition failures are sanitized without retry',async()=>{const f=fixture();f.connect.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));await expect(f.store().lookupAccount('synthetic@example.invalid')).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.connect).toHaveBeenCalledTimes(1);});
 it('protected unknown commit discards connection, never repeats transaction',async()=>{const f=fixture();f.connection.query.mockImplementation(async sql=>{f.calls.push(sql);if(sql==='COMMIT')throw new Error('SYNTHETIC-PRIVATE');return {rows:[],rowCount:1};});await expect(f.store().lookupAccount('synthetic@example.invalid')).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.connection.release).toHaveBeenCalledWith(true);expect(f.connect).toHaveBeenCalledTimes(1);});
 it('re-quarantine records metadata but never rewrites an already QUARANTINED job',async()=>{const f=fixture();const store=new quarantinePg.PostgresNotificationQuarantineStore({connect:f.connect} as never);expect(await store.quarantine({source:'protected',id:'job',version:'1',state:'QUARANTINED'},'RESTORED')).toBe(true);expect(f.calls.some(sql=>sql.startsWith('UPDATE public."ProtectedAuthJob"'))).toBe(false);});
});

describe('Prisma/SQL/adapter mapping and additive preservation contracts',()=>{
 const read=(file:string)=>readFileSync(resolve(__dirname,'../..',file),'utf8');
 const drafts=['protected-schema','replay-recovery','compatible-worker','contracts'].map(n=>'docs/proposals/phase1-'+n+'.additive.DRAFT.sql');
 const modelNames=['AuthSecurityState','ProtectedCredential','ProtectedAuthJob','PassengerSecret','AuthIssuanceRequest','NotificationQuarantine','CompatibleNotificationLease','NotificationSendIntent'];
 // Lexical regression only: a PostgreSQL parser/transaction check remains a live gate.
 function checkBodyQuotes(body:string):void {
  let quote='';
  for(let i=0;i<body.length;i++){
   const c=body[i];
   if(quote){if(c===quote){if(body[i+1]===quote)i++;else quote='';}}
   else if(c==='\''||c==='"')quote=c;
   else if(c==='-'&&body[i+1]==='-'){while(i<body.length&&body[i]!=='\n')i++;}
  }
  if(quote)throw new Error('UNTERMINATED_SQL_BODY_QUOTE');
 }
 it('rejects the actual failed leaseUntil identifier and accepts corrected function bodies',()=>{
  expect(()=>checkBodyQuotes(`AND NEW."leaseUntil"=OLD."leaseUntil')) THEN`)).toThrow('UNTERMINATED_SQL_BODY_QUOTE');
  for(const file of drafts)for(const match of read(file).matchAll(/\$\$([\s\S]*?)\$\$/g))expect(()=>checkBodyQuotes(match[1])).not.toThrow();
  expect(read(drafts[3])).toContain('AND NEW."workerId"=OLD."workerId" AND NEW."leaseUntil"=OLD."leaseUntil")) THEN');
 });
 for(const name of modelNames)it('maps every sidecar table '+name,()=>{const sql=drafts.map(read).join('\n'),prisma=read('server/prisma/phase1/schema.prisma');expect(sql).toContain('CREATE TABLE public."'+name+'"');expect(prisma).toContain('model '+name+' {');});
 it('candidate retains every old scalar field and default; active schema/client remain isolated',()=>{const current=read('server/prisma/schema.prisma'),candidate=read('server/prisma/phase1/schema.prisma');for(const line of current.split(/\r?\n/).filter(l=>l.trim()&&!l.trim().startsWith('//')&&!l.includes('output ')))expect(candidate).toContain(line);expect(candidate).toContain('../../src/generated/phase1-candidate');expect(read('server/prisma.config.ts')).toContain("schema: 'prisma/schema.prisma'");expect(read('server/prisma/phase1/prisma.config.cjs')).not.toMatch(/env|dotenv|datasource|migrations/);});
 it('candidate tail equals reviewed model source',()=>{expect(read('server/prisma/phase1/schema.prisma')).toContain(read('server/prisma/phase1/protected-models.prisma.part'));});
 it('no draft deletes, rewrites existing records, grants or resets',()=>{for(const f of drafts){const sql=read(f).replace(/--[^\n]*/g,'');expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|GRANT|REVOKE)\b(?!\s+RESTRICT)/i);expect(sql).toMatch(/BEGIN;/);expect(sql.trim()).toMatch(/COMMIT;$/);}});
 it('SQL owns deferred cycles, receipt completion and immutable completed receipt',()=>{const sql=read(drafts[0])+read(drafts[1]);expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)?.length).toBe(3);expect(sql).toContain('CREATE CONSTRAINT TRIGGER protected_request_complete');expect(sql).toContain("OLD.state='COMMITTED'");expect(sql).toContain('protected_session_subject');});
 it('active-purpose uniqueness is partial and cannot create two live credentials',()=>{expect(read(drafts[3])).toContain('CREATE UNIQUE INDEX protected_one_live_purpose');expect(read(drafts[3])).toContain('WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL');});
 it('keeps PostgreSQL regex bounds within255 and separates ciphertext length from alphabet',()=>{
  const sql=read(drafts[3]);
  expect(sql).toContain("char_length(value->>'ciphertext') BETWEEN 1 AND 5500");
  expect(sql).toContain("value->>'ciphertext' !~ '[^A-Za-z0-9_-]'");
  for(const m of sql.matchAll(/\{(\d+)(?:,(\d+))?\}/g))for(const bound of m.slice(1).filter(Boolean))expect(Number(bound)).toBeLessThanOrEqual(255);
 });
 // Predicate equivalence only, not a claim that Node runs PostgreSQL's regex engine.
 it.each([0,1,255,256,5499,5500,5501])('preserves ciphertext length boundary %s',length=>{
  const value='A'.repeat(length);
  expect(value.length>=1&&value.length<=5500&&!/[^A-Za-z0-9_-]/.test(value)).toBe(length>=1&&length<=5500);
 });
 it.each(['+','/','=',' ','\n','\r','é','中','\0'])('rejects disallowed ciphertext alphabet %j',invalid=>{
  expect(!/[^A-Za-z0-9_-]/.test('AA'+invalid+'AA')).toBe(false);
 });
 it('credential/job identity and terminal send state cannot be overwritten',()=>{const sql=read(drafts[3]);expect(sql).toContain('protected_credential_immutable');expect(sql).toContain("OLD.state='SENDING' AND NEW.state IN ('SUBMITTED','SUPPRESSED','AMBIGUOUS')");expect(sql).toContain('NEW.version=OLD.version+1');expect(sql).toContain('NEW."workerId"=OLD."workerId"');});
 it('passenger ownership, revision and encryption envelope constraints stay SQL enforced',()=>{const sql=read(drafts[0])+read(drafts[3]);expect(sql).toContain('REFERENCES public."BookingPassenger"(id,"bookingId")');expect(sql).toContain('NEW.revision<>OLD.revision+1');expect(sql).toContain('passenger_envelope_shape');expect(sql).toContain("ARRAY['version','keyRef','nonce','ciphertext','tag']");});
 it('send intents are durable, terminal and never restored to a resendable state',()=>{const sql=read(drafts[2]);expect(sql).toContain('PRIMARY KEY("recordId",version)');expect(sql).toContain("OLD.state<>'SENDING'");expect(sql).not.toContain("SET state='SENDING'");});
 it('retirement marker is nullable/additive but cannot be cleared once completed',()=>{const sql=read(drafts[3]);expect(sql).toContain('ADD COLUMN "legacyRetiredAt" timestamptz');expect(sql).toContain('OLD."legacyRetiredAt" IS NOT NULL');expect(sql).toContain('PROTECTED_ENROLLMENT_REGRESSION');const adapter=read('server/src/security/protected-auth.pg.ts');expect(adapter).toContain('if(marked.rowCount!==1)');});
 it('unretired email updates remain legacy-compatible, enrolled identities still revoke credentials/sessions',()=>{const sql=read(drafts[3]);expect(sql).toContain('CREATE OR REPLACE FUNCTION public.protected_identity_generation()');expect(sql).toContain('WHERE "userId"=NEW.id AND "legacyRetiredAt" IS NOT NULL');expect(sql).toContain('IF NOT FOUND THEN RETURN NEW; END IF;');expect(sql).toContain('UPDATE public."ProtectedCredential" SET "revokedAt"');expect(sql).toContain('UPDATE public."Session" SET "revokedAt"');});
 it('indexes cover lookup, FIFO dispatch, parent references and receipts',()=>{const sql=read(drafts[3]);for(const name of ['protected_credential_subject_lookup','protected_job_dispatch','passenger_secret_booking','issuance_receipt_subject','issuance_receipt_job','issuance_receipt_session'])expect(sql).toContain('CREATE INDEX '+name);});
 it('isolated preflight pins all seven original migration checksums without modifying their history',()=>{const sql=read('docs/proposals/phase1-schema.preflight.readonly.sql');const pairs=[...sql.matchAll(/\('(2026[^']+)','([a-f0-9]{64})'\)/g)];expect(pairs).toHaveLength(7);for(const [,name,hash] of pairs){expect(createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',name,'migration.sql'))).digest('hex')).toBe(hash);}expect(sql).toContain("current_database()<>'flywithsafe_phase1_schema_integration'");expect(sql).toContain('BEGIN READ ONLY');});
 it('review-only constraint probe confines synthetic rows to a rolled-back transaction and stops on error',()=>{const sql=read('docs/proposals/phase1-constraints.rollback.review.sql');expect(sql).toContain('\\set ON_ERROR_STOP on');expect(sql).toContain('BEGIN;');expect(sql.trim()).toMatch(/postcheck even after probe failure\.$/);expect(sql).toContain('ROLLBACK;');expect(sql).not.toMatch(/^COMMIT;/m);expect(sql).not.toMatch(/GRANT|TRUNCATE|DELETE FROM/);expect(sql).toContain("current_database()<>'flywithsafe_phase1_schema_integration'");});
});
