/** Genuine local browser/API/PostgreSQL acceptance. Requires explicit persistent-fixture approval. */
import { it, vi } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { PrismaClient, Prisma as PrismaType } from '../../src/generated/prisma/client.js';
import type { Browser, BrowserContext, Page } from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';
import { disposableTarget } from '../p5-disposable-target.js';

const local=createRequire(__filename),repo=path.resolve(__dirname,'../../..');
const out=path.join(repo,'output/phase5/p5-browser-20261108-01');
const S=local('./scope.cjs') as {prefix:string;emails:Record<string,string>;ids:Record<string,string>;books:string[];createLimiter:()=>{wrap:<T extends object>(v:T)=>T;users:Map<string,string>;sessions:Set<string>;summary:()=>object}};
const {safeDiagnostic}=local('./output-contract.cjs') as {safeDiagnostic:(e:unknown)=>object};
const front='http://127.0.0.1:38191',api='http://127.0.0.1:38192/api/v1';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
it.skipIf(process.env.P5_BROWSER_EXECUTION_APPROVED!=='true')('four-role browser and remaining identity acceptance',async()=>{
  const target=disposableTarget(process.env);
  assert(target.database==='flywithsafety_p5_identity_scope_test'&&target.role==='fws_p5_identity_app'&&target.oid===35402);
  const cap=S.createLimiter(),checks:Array<{check:string;status:'PASS'}>=[],sink=new Map<string,string>();
  const passwords=Object.fromEntries(['owner','admin','staff','customer','foreign'].map(r=>[r,'Synthetic-'+randomBytes(20).toString('hex')+'Aa8!']));
  const secrets=new Map<string,string>(),recoveries=new Map<string,string[]>(),contexts:BrowserContext[]=[];
  let db:PrismaClient,raw:PrismaClient|undefined,P:typeof PrismaType,server:Server|undefined,next:ChildProcess|undefined,browser:Browser|undefined;
  let stage='INITIAL',phases=0,passed=false,closure=false,nextStopped=false;
  const journal=(data:object)=>fs.appendFileSync(path.join(out,'browser-journal.jsonl'),JSON.stringify({utc:new Date().toISOString(),...data})+'\n');
  async function step<T>(name:string,work:()=>Promise<T>){stage=name;journal({stage,event:'START'});const value=await work();checks.push({check:name,status:'PASS'});journal({stage,event:'PASS'});return value;}
  const actorIds:Record<string,string>={...S.ids};
  const env={nodeEnv:'test',jwtSecret:process.env.P5_BROWSER_JWT_SECRET!,jwtExpiresIn:'15m',accessTokenCookieMaxAgeMs:900000,refreshTokenExpiresDays:1,
    frontendUrl:front,apiBaseUrl:'http://127.0.0.1:38192',corsOrigins:[front],corsOrigin:front,
    authRateLimitWindowMs:900000,authRateLimitMax:10,rateLimitWindowMs:900000,rateLimitMax:100,
    emailDeliveryEnabled:false,smtpUser:'',smtpPassword:'',googleClientId:'',googleClientSecret:'',googleCallbackUrl:''};
  async function stopApi(){if(server){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server!.close(e=>e?reject(e):resolve()));server=undefined;}if(raw){await raw.$disconnect();raw=undefined;}}
  async function startApi(){
    await stopApi();assert(++phases<=3,'ISOLATED_APP_PHASE_CAP');vi.resetModules();
    const generated=await import('../../src/generated/prisma/client.js');P=generated.Prisma;
    const {PrismaPg}=await import('@prisma/adapter-pg');
    raw=new generated.PrismaClient({adapter:new PrismaPg({connectionString:target.connectionString,connectionTimeoutMillis:5000,statement_timeout:5000,options:'-c search_path=pg_catalog,public'})});
    db=cap.wrap(raw);
    const rows=await db.$queryRaw<Array<{database:string;role:string;oid:number;address:string;port:number;unsafe:boolean}>>(P.sql`SELECT current_database() AS database,current_user::text AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS address,inet_server_port() AS port,(SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS unsafe`);
    assert.deepEqual(rows,[{database:target.database,role:target.role,oid:35402,address:'127.0.0.1',port:5432,unsafe:false}]);
    vi.doMock('../../src/lib/prisma.js',()=>({prisma:db}));vi.doMock('../../src/config/env.js',()=>({env}));
    vi.doMock('dotenv',()=>{throw Error('PRIVATE_ENV_DISCOVERY_FORBIDDEN');});
    vi.doMock('nodemailer',()=>({default:{createTransport:()=>{throw Error('SMTP_FORBIDDEN');}}}));
    vi.doMock('../../src/services/notification.service.js',()=>({
      sendEmailRaw:async(input:{to:string;text:string})=>{assert([S.emails.admin,S.emails.staff,S.emails.expired].includes(input.to),'MAIL_RECIPIENT_SCOPE');const token=/#([A-Za-z0-9_-]{43})/.exec(input.text)?.[1];assert(token,'LOCAL_SINK_TOKEN_REQUIRED');sink.set(input.to,token);return{status:'submitted'};},
      sendEmailVerification:()=>{throw Error('EXTERNAL_MAIL_FORBIDDEN');},sendPasswordReset:()=>{throw Error('EXTERNAL_MAIL_FORBIDDEN');},
      sendBookingConfirmation:()=>{throw Error('EXTERNAL_MAIL_FORBIDDEN');},sendBookingStatusNotification:()=>{throw Error('EXTERNAL_MAIL_FORBIDDEN');},
    }));
    const imported=await import('../../src/app.js');let application:unknown=imported;
    for(let i=0;i<3&&typeof application!=='function';i++){assert(application&&typeof application==='object'&&'default'in application);application=application.default;}
    assert.equal(typeof application,'function');
    server=createServer(application as import('express').Express);
    await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(38192,'127.0.0.1',resolve);});
    journal({stage:'ISOLATED_APP_READY',phase:phases,authLimit:10,identityLimit:30});
  }
  async function request(page:Page,endpoint:string,status:number,method='GET',data?:object){
    const r=await page.context().request.fetch(api+endpoint,{method,data,headers:{Origin:front},maxRedirects:0,timeout:10000});
    assert.equal(r.status(),status,'EXPECTED_LOCAL_API_STATUS');return r;
  }
  async function newPage(){const c=await browser!.newContext({serviceWorkers:'block'});contexts.push(c);await c.route('**/*',r=>[front,'http://127.0.0.1:38192'].includes(new URL(r.request().url()).origin)?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(15000);return p;}
  async function navigate(page:Page,where:string){await page.goto(front+where,{waitUntil:'domcontentloaded',timeout:60000});}
  async function submit(page:Page,endpoint:string,action:()=>Promise<unknown>,status=200){const wait=page.waitForResponse(r=>r.url()===api+endpoint&&r.request().method()!=='GET');await action();assert.equal((await wait).status(),status,'EXPECTED_UI_API_STATUS');}
  async function login(page:Page,role:string){const refresh=page.waitForResponse(r=>r.url()===api+'/auth/refresh');await navigate(page,'/account/security');assert.equal((await refresh).status(),401,'GUEST_REFRESH_SETTLED');await page.getByRole('button',{name:'Sign in to your FlyWithSafety account',exact:true}).click();await page.getByLabel('Email Address',{exact:true}).fill(S.emails[role]);await page.getByLabel('Password',{exact:true}).fill(passwords[role]);await submit(page,'/auth/login',()=>page.getByRole('dialog').getByRole('button',{name:'Sign In',exact:true}).click());await page.getByRole('dialog').waitFor({state:'hidden'});}
  async function enroll(page:Page,role:string){
    await navigate(page,'/account/security');await page.getByLabel('Current password',{exact:true}).fill(passwords[role]);
    await submit(page,'/identity/mfa/enroll',()=>page.getByRole('button',{name:'Begin authenticator setup',exact:true}).click());
    const secret=await page.locator('code').innerText();assert(/^[A-Z2-7]+$/.test(secret));secrets.set(role,secret);
    const {totp}=await import('../../src/identity/crypto.js');await page.getByLabel('Confirmation code',{exact:true}).fill(totp(secret,BigInt(Math.floor(Date.now()/30000))));
    await submit(page,'/identity/mfa/confirm',()=>page.getByRole('button',{name:'Confirm setup',exact:true}).click());
    const recovery=(await page.locator('pre').innerText()).trim().split(/\s+/);assert(recovery.length===10&&recovery.every(x=>/^[a-f0-9]{32}$/.test(x)));recoveries.set(role,recovery);
    await page.getByRole('button',{name:'I have saved them',exact:true}).click();
  }
  async function recover(page:Page,role:string){await navigate(page,'/account/security');await page.getByText('Use a recovery code',{exact:true}).click();const code=recoveries.get(role)!.shift()!;await page.getByLabel('Private recovery code',{exact:true}).fill(code);await submit(page,'/identity/mfa/recover',()=>page.getByRole('button',{name:'Use code once',exact:true}).click());await request(page,'/identity/mfa/recover',401,'POST',{code});}
  async function invite(page:Page,email:string,role:'ADMIN'|'STAFF'){
    const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Invite an individual employee',exact:true})});
    await form.getByLabel('Employee email',{exact:true}).fill(email);await form.getByLabel('Role',{exact:true}).selectOption(role);await form.getByLabel('FLIGHT',{exact:true}).check();
    await submit(page,'/identity/invitations',()=>form.getByRole('button',{name:'Send invitation',exact:true}).click(),201);assert(sink.has(email));
  }
  async function accept(page:Page,role:string,status=200,token=sink.get(S.emails[role])!){
    assert(/^[A-Za-z0-9_-]{43}$/.test(token));await navigate(page,'/invite#'+token);
    await page.getByLabel('Name',{exact:true}).fill('Synthetic '+role);
    await page.getByLabel('Personal password (8–128 characters, uppercase, lowercase and number)',{exact:true}).fill(passwords[role]||passwords.staff);
    await submit(page,'/identity/invitations/accept',()=>page.getByRole('button',{name:'Activate account',exact:true}).click(),status);
    // Never capture invitation URLs or password fields in evidence.
    await page.getByLabel('Personal password (8–128 characters, uppercase, lowercase and number)',{exact:true}).fill('');
  }
  const shot=async(page:Page,role:string)=>{await page.screenshot({path:path.join(out,role+'-workspace.png'),fullPage:true});};
  async function userId(role:string){const u=await db.user.findUnique({where:{email:S.emails[role]},select:{id:true}});assert(u);actorIds[role]=u.id;return u.id;}
  try{
    process.env.IDENTITY_SCOPE_ENABLED='true';process.env.IDENTITY_INVITATION_DELIVERY_APPROVED='true';process.env.FRONTEND_URL=front;
    await step('EXACT_TARGET_AND_LOCAL_RUNTIME',startApi);
    await step('ISOLATED_FRONTEND_READY_BEFORE_FIXTURES',async()=>{
      const childEnv:NodeJS.ProcessEnv={};for(const k of ['SystemRoot','WINDIR','ProgramData','ProgramFiles','ProgramFiles(x86)','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[k])childEnv[k]=process.env[k];
      Object.assign(childEnv,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',FWS_P5_BROWSER_TEST:'true',FWS_P5_NETWORK_FENCE:'true',FWS_P5_FRONTEND_ONLY:'true',NODE_OPTIONS:'--require "'+path.join(__dirname,'network-fence.cjs').replaceAll('\\','/')+'"',NEXT_PUBLIC_LOCAL_API_BASE_URL:api,NEXT_PUBLIC_SITE_URL:front});
      next=spawn(process.execPath,[path.join(repo,'client/node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','38191'],{cwd:path.join(repo,'client'),env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let bytes=0;next.stdout!.on('data',b=>{bytes+=b.length;});next.stderr!.on('data',b=>{bytes+=b.length;});
      let ready=false;for(let i=0;i<60;i++){assert(next.exitCode===null,'FRONTEND_EXIT_BEFORE_READY');try{const r=await fetch(front+'/account/security',{redirect:'error',signal:AbortSignal.timeout(2000)});if(r.status===200){ready=true;break;}}catch{}await delay(1000);}
      assert(ready,'FRONTEND_READINESS_DEADLINE');journal({stage:'FRONTEND_READY',outputBytes:bytes});
    });
    await step('OWNED_SYNTHETIC_SEEDS',async()=>{
      const bcrypt=await import('bcryptjs');
      for(const role of ['owner','customer','foreign'])await db.user.create({data:{id:S.ids[role],email:S.emails[role],name:'Synthetic '+role,password:await bcrypt.hash(passwords[role],12),role:role==='owner'?'ADMIN':'CUSTOMER',emailVerified:true}});
      for(const [i,role]of ['customer','foreign'].entries())await db.booking.create({data:{id:S.books[i],referenceNumber:(S.prefix+(i?'-FOREIGN':'-OWN')).toUpperCase(),userId:S.ids[role],customerName:'Synthetic '+role,customerEmail:S.emails[role],bookingType:'FLIGHT'}});
    });
    const {chromium}=local('C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright') as typeof import('C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'pins.json'),'utf8'));
    browser=await chromium.launch({executablePath:manifest.chrome,headless:true,timeout:15000,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check']});
    const owner=await newPage();
    await step('OWNER_REAL_LOGIN_MFA_AND_BOOTSTRAP',async()=>{
      await login(owner,'owner');await request(owner,'/identity/customers',403);await enroll(owner,'owner');
      const {provisionPrimaryOwner}=await import('../../src/identity/bootstrap.js');
      await provisionPrimaryOwner(db,{userId:S.ids.owner,verifiedEmail:S.emails.owner,expectedDatabase:target.database,expectedOid:35402,ownerApproved:true});
      await request(owner,'/identity/me',401);await request(owner,'/auth/logout',200,'POST',{});await login(owner,'owner');await recover(owner,'owner');
      await navigate(owner,'/owner');await owner.getByRole('heading',{name:'Super Admin Control Center',exact:true}).waitFor();
    });
    await step('OWNER_SELF_DEMOTION_AND_AUDIT_UI',async()=>{
      const form=owner.locator('form').filter({has:owner.getByRole('button',{name:'Apply account change',exact:true})});await form.getByLabel('Exact user ID',{exact:true}).fill(S.ids.owner);await form.getByLabel('Role',{exact:true}).selectOption('CUSTOMER');
      await submit(owner,'/identity/users/'+S.ids.owner,()=>form.getByRole('button',{name:'Apply account change',exact:true}).click(),403);
      const audit=owner.waitForResponse(r=>r.url()===api+'/identity/audit');await owner.getByRole('button',{name:'Load security audit',exact:true}).click();assert.equal((await audit).status(),200);await owner.getByText('PRIMARY_OWNER_PROVISIONED',{exact:false}).first().waitFor();await shot(owner,'SUPER_ADMIN');
    });
    const adminPage=await newPage(),guest=await newPage();
    await step('ADMIN_INVITATION_ACCEPT_REPLAY_EXPIRY',async()=>{
      await invite(owner,S.emails.admin,'ADMIN');const original=sink.get(S.emails.admin)!;await accept(adminPage,'admin');await userId('admin');await accept(guest,'admin',400,original);
      await invite(owner,S.emails.expired,'STAFF');const inv=await db.$queryRaw<Array<{id:string}>>(P.sql`SELECT id FROM "IdentityInvitation" WHERE email=${S.emails.expired}`);assert.equal(inv.length,1);
      assert.equal(await db.$executeRaw(P.sql`/*p5:browser-expire*/ UPDATE "IdentityInvitation" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=${inv[0].id} AND email=${S.emails.expired} AND "usedAt" IS NULL`),1);
      await accept(guest,'expired',400);assert.equal(await db.user.count({where:{email:S.emails.expired}}),0);
    });
    await step('ADMIN_PHASE_NEW_ISOLATED_APP',startApi);
    await step('ADMIN_REAL_MFA_ENROLLMENT_AND_CHALLENGE',async()=>{
      await login(adminPage,'admin');await request(adminPage,'/identity/customers',403);await enroll(adminPage,'admin');await request(adminPage,'/auth/logout',200,'POST',{});await login(adminPage,'admin');
      const row=await db.$queryRaw<Array<{lastStep:bigint}>>(P.sql`SELECT "lastStep" FROM "IdentityMfa" WHERE "userId"=${actorIds.admin}`);assert.equal(row.length,1);
      const wait=(Number(row[0].lastStep)+1)*30000-Date.now()+200;if(wait>0){assert(wait<=31000);await delay(wait);}
      await navigate(adminPage,'/account/security');const {totp}=await import('../../src/identity/crypto.js');const code=totp(secrets.get('admin')!,BigInt(Math.floor(Date.now()/30000)));
      await adminPage.getByLabel('Authenticator code',{exact:true}).fill(code);await submit(adminPage,'/identity/mfa/verify',()=>adminPage.getByRole('button',{name:'Verify second factor',exact:true}).click());await request(adminPage,'/identity/mfa/verify',401,'POST',{code});
      await navigate(adminPage,'/staff');await adminPage.getByRole('heading',{name:'Admin Operations Console',exact:true}).waitFor();assert.equal(await adminPage.getByRole('button',{name:'Load security audit',exact:true}).count(),0);await request(adminPage,'/identity/audit',403);await shot(adminPage,'ADMIN');
    });
    const staffPage=await newPage();
    await step('ADMIN_INVITES_STAFF_VIA_UI',async()=>{await invite(adminPage,S.emails.staff,'STAFF');await accept(staffPage,'staff');await userId('staff');});
    await step('STAFF_CUSTOMER_PHASE_NEW_ISOLATED_APP',startApi);
    await step('STAFF_ENROLLMENT_AND_ASSIGNMENT_REVOCATION',async()=>{
      await login(staffPage,'staff');await enroll(staffPage,'staff');
      const form=adminPage.locator('form').filter({has:adminPage.getByRole('button',{name:'Apply assignment',exact:true})});
      await form.getByLabel('Exact user ID',{exact:true}).fill(actorIds.staff);await form.getByLabel('Exact record ID',{exact:true}).fill(S.books[0]);await form.getByLabel('Department',{exact:true}).selectOption('FLIGHT');
      await submit(adminPage,'/identity/assignments',()=>form.getByRole('button',{name:'Apply assignment',exact:true}).click());
      await request(staffPage,'/identity/me',401);await request(staffPage,'/auth/logout',200,'POST',{});await login(staffPage,'staff');await recover(staffPage,'staff');
      await navigate(staffPage,'/staff');await staffPage.getByRole('heading',{name:'Department Staff Workspace',exact:true}).waitFor();
      await request(staffPage,'/admin/inquiries/hotels',403);await request(staffPage,'/identity/customers',403);await request(staffPage,'/admin/bookings/'+S.books[1]+'/status',404,'PATCH',{status:'PENDING'});
      const list=await request(staffPage,'/admin/bookings',200);const refs=(await list.json()).data.bookings.map((b:{referenceNumber:string})=>b.referenceNumber);assert(refs.includes((S.prefix+'-OWN').toUpperCase())&&!refs.includes((S.prefix+'-FOREIGN').toUpperCase()));await staffPage.getByRole('button',{name:'Bookings Processing',exact:true}).click();await staffPage.getByText((S.prefix+'-OWN').toUpperCase(),{exact:true}).first().waitFor();assert.equal(await staffPage.getByText((S.prefix+'-FOREIGN').toUpperCase(),{exact:true}).count(),0);await shot(staffPage,'STAFF');
    });
    const customer=await newPage();
    await step('CUSTOMER_UI_AND_OWNERSHIP_BOUNDARIES',async()=>{
      await login(customer,'customer');await navigate(customer,'/account');await customer.getByRole('heading',{name:'Account dashboard',exact:true}).waitFor();
      await request(customer,'/account/bookings/'+(S.prefix+'-OWN').toUpperCase(),200);await request(customer,'/account/bookings/'+(S.prefix+'-FOREIGN').toUpperCase(),404);
      await navigate(customer,'/owner');await customer.getByText('Authorized workspace access is required.',{exact:true}).waitFor();await request(customer,'/identity/audit',403);await navigate(customer,'/account');await shot(customer,'CUSTOMER');
    });
    await step('BROWSER_SUSPENSION_DEMOTION_AND_VERSION_ENFORCEMENT',async()=>{
      const before=await db.$queryRaw<Array<{userId:string;version:number}>>(P.sql`SELECT "userId",version FROM "IdentityAccount" WHERE "userId" IN (${actorIds.admin},${actorIds.customer})`);assert.equal(before.length,2);
      const form=adminPage.locator('form').filter({has:adminPage.getByRole('button',{name:'Apply account change',exact:true})});await form.getByLabel('Exact user ID',{exact:true}).fill(actorIds.customer);await form.getByLabel('Status',{exact:true}).selectOption('true');
      await submit(adminPage,'/identity/users/'+actorIds.customer,()=>form.getByRole('button',{name:'Apply account change',exact:true}).click());await request(customer,'/identity/me',401);await navigate(customer,'/account/security');await customer.getByText('Sign in to manage your account security.',{exact:true}).waitFor();
      const ownerForm=owner.locator('form').filter({has:owner.getByRole('button',{name:'Apply account change',exact:true})});await ownerForm.getByLabel('Exact user ID',{exact:true}).fill(actorIds.admin);await ownerForm.getByLabel('Role',{exact:true}).selectOption('CUSTOMER');
      await submit(owner,'/identity/users/'+actorIds.admin,()=>ownerForm.getByRole('button',{name:'Apply account change',exact:true}).click());await request(adminPage,'/identity/me',401);
      await navigate(adminPage,'/account/security');await adminPage.getByText('Sign in to manage your account security.',{exact:true}).waitFor();
      const after=await db.$queryRaw<Array<{userId:string;version:number}>>(P.sql`SELECT "userId",version FROM "IdentityAccount" WHERE "userId" IN (${actorIds.admin},${actorIds.customer})`);for(const r of after)assert.equal(r.version,before.find(b=>b.userId===r.userId)!.version+1);
    });
    await step('AUDIT_AND_FINAL_ROLE_PERSISTENCE',async()=>{
      const actions=await db.$queryRaw<Array<{action:string}>>(P.sql`SELECT action FROM "IdentityAudit"`);
      for(const name of ['PRIMARY_OWNER_PROVISIONED','INVITE_ACCEPTED','ASSIGNMENT_CHANGED','ACCOUNT_STATUS_CHANGED','ROLE_CHANGED','MFA_ENROLLED','MFA_RECOVERY_USED','MFA_REJECTED'])assert(actions.some(r=>r.action===name),'EXPECTED_AUDIT_ACTION');
      const roles=await db.user.findMany({select:{id:true,role:true}});
      for(const [r,expected]of Object.entries({owner:'SUPER_ADMIN',admin:'CUSTOMER',staff:'STAFF',customer:'CUSTOMER',foreign:'CUSTOMER'}))assert.equal(roles.find(v=>v.id===actorIds[r])?.role,expected,'FINAL_ROLE_PERSISTENCE');
    });
    passed=true;
  }catch(error){journal({stage,event:'FAIL',...safeDiagnostic(error)});throw error;}
  finally{
    try{if(raw){
      const owned=[...cap.users.keys()];if(owned.length){
      for(const id of owned)await db!.$executeRaw(P!.sql`/*p5:ensure-account*/ INSERT INTO "IdentityAccount" ("userId") VALUES (${id}) ON CONFLICT DO NOTHING`);
      await db!.$executeRaw(P!.sql`/*p5:browser-close-session*/ UPDATE "Session" SET "revokedAt"=clock_timestamp() WHERE "userId" IN (${P!.join(owned)}) AND "revokedAt" IS NULL`);
      await db!.$executeRaw(P!.sql`/*p5:browser-close-account*/ UPDATE "IdentityAccount" SET suspended=true,version=version+1 WHERE "userId" IN (${P!.join(owned)})`);
      }
      closure=true;
    }}catch(error){passed=false;journal({stage:'OWNED_FIXTURE_CLOSURE',event:'FAIL',...safeDiagnostic(error)});}
    for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});
    if(next){if(next.exitCode!==null)nextStopped=true;else{const stopped=new Promise<void>(resolve=>next!.once('close',()=>{nextStopped=true;resolve();}));next.kill();await Promise.race([stopped,delay(5000)]);}}
    await stopApi().catch(()=>{passed=false;});
    fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({passed:passed&&closure&&nextStopped,stage,checks,phases,closure,nextStopped,...cap.summary(),providerCalls:0,productionActivated:false},null,2));
    sink.clear();secrets.clear();recoveries.clear();for(const k of Object.keys(passwords))passwords[k]='';
    assert(passed&&closure&&nextStopped,'BROWSER_ACCEPTANCE_OR_OWNED_CLEANUP_FAILED');
  }
},840000);
