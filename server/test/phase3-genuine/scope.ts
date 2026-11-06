import type { PrismaClient, Prisma } from '../../src/generated/prisma/client.js';
import type { Gateway, Customer } from '../../src/payments/sslcommerz.js';
import type { PaymentStore, Ledger } from '../../src/payments/payment-store.js';
export type Fixture = { name: 'success'|'fail'|'cancel'; bookingId:string; passengerId:string; historyId:string; quoteId:string; requestId:string; reference:string; customerId:string; amount:number };
export type Plan = { actors:Array<{id:string;email:string;role:'CUSTOMER'|'STAFF'|'ADMIN'}>; fixtures:Fixture[]; caps:Record<string,number> };
type WriteInput={where?:{id?:string};data?:{id?:string;userId?:string;totalPrice?:number;currency?:string;status?:string;passengers?:{create?:{id?:string}};statusHistory?:{create?:{id?:string}};bookingDetails?:{integrationFixture?:{genuineSandbox?:boolean};commercial?:{quotes?:Array<{id:string;amount:number;currency:string;acceptedAt?:string}>}};bookingId?:string;fromStatus?:string;toStatus?:string;changedBy?:string;payload?:{params?:{referenceNumber?:string}};recipient?:string;idempotencyKey?:string}};
export class Scope {
 closed=false;
 readonly counts:Record<string,number>={}; readonly payments=new Map<string,{id:string;tranId:string;fixture:Fixture}>(); readonly validations=new Set<string>();
 constructor(readonly plan:Plan,readonly record:(e:object)=>void){if(plan.fixtures.length!==3||new Set(plan.fixtures.map(f=>f.reference)).size!==3)throw Error('EXACT_PLAN_REQUIRED');}
 reserve(kind:string,n=1){if(this.closed)throw Error('RUN_CLOSED');if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(this.plan.caps[kind])||(this.counts[kind]||0)+n>this.plan.caps[kind])throw Error('WRITE_OR_PROVIDER_CAP_EXCEEDED');this.counts[kind]=(this.counts[kind]||0)+n;this.record({kind:'budget',operation:kind,attempts:this.counts[kind]});}
 fixture(id:string){const f=this.plan.fixtures.find(f=>f.bookingId===id||f.reference===id);if(!f)throw Error('UNOWNED_BOOKING');return f;}
 bind(values:unknown[]){const [id,bookingId,userId,requestId,tranId,,,,,json]=values;const f=this.fixture(String(bookingId));const state=JSON.parse(String(json));if(userId!==f.customerId||requestId!==f.requestId||state.id!==id||state.tranId!==tranId||state.bookingId!==f.bookingId||state.userId!==f.customerId||state.quoteId!==f.quoteId||state.amountMinor!==String(f.amount*100)||state.currency!=='BDT')throw Error('UNOWNED_PAYMENT');
 const existing=this.payments.get(String(id));if(!existing){if([...this.payments.values()].some(p=>p.fixture.bookingId===f.bookingId))throw Error('SECOND_PAYMENT_FOR_CASE');this.reserve('payments');this.payments.set(String(id),{id:String(id),tranId:String(tranId),fixture:f});this.record({kind:'planned-payment',id,bookingId,tranId});}else if(existing.tranId!==tranId||existing.fixture!==f)throw Error('PAYMENT_IDENTITY_CHANGED');this.reserve('saves');}
 database(base:PrismaClient):PrismaClient {
 const scope={plan:this.plan,fixture:this.fixture.bind(this),reserve:this.reserve.bind(this),bind:this.bind.bind(this),record:this.record,payments:this.payments};
 function transaction(tx:Prisma.TransactionClient):Prisma.TransactionClient {return new Proxy(tx,{get(target,key){
 if(key==='$executeRawUnsafe')return()=>{throw Error('UNAPPROVED_RAW_WRITE');};
 if(key==='$executeRaw')return async(...args:unknown[])=>{const q=args[0] as Prisma.Sql;const text=q?.strings?.join('?')||'';if(text.startsWith('INSERT INTO public."GatewayPayment" '))scope.bind(q.values);else if(text.startsWith('INSERT INTO public."GatewayPaymentEvent" ')){if(!scope.payments.has(String(q.values[1])))throw Error('UNOWNED_EVENT');scope.reserve('events');const data=JSON.parse(String(q.values[4]));scope.record({kind:'planned-event',id:q.values[0],paymentId:q.values[1],eventKind:q.values[2],failureCategory:typeof data.category==='string'&&/^(GATEWAY_(UNAVAILABLE|MALFORMED|AUTHENTICATION|MISMATCH)|DATABASE_OR_VALIDATION|UNRESOLVED)$/.test(data.category)?data.category:null});}else throw Error('UNAPPROVED_RAW_WRITE');return Reflect.apply(target.$executeRaw,target,args);};
 if(typeof key==='string'&&['booking','bookingPassenger','bookingStatusHistory','notificationOutbox','user'].includes(key)){
 const delegate=Reflect.get(target,key) as object;
 return new Proxy(delegate,{get(d,method){const fn=Reflect.get(d,method);if(typeof fn!=='function')return fn;
 return async(arg:WriteInput)=>{ // Prisma delegate overloads are normalized only at this test boundary.
 const data=arg?.data||{};
 if(method==='create'&&key==='booking'){
 const f=scope.fixture(String(data?.id)),q=data?.bookingDetails?.commercial?.quotes;if(data.userId!==f.customerId||data.totalPrice!==f.amount||data.currency!=='BDT'||data.status!=='PENDING'||data.passengers?.create?.id!==f.passengerId||data.statusHistory?.create?.id!==f.historyId||data.bookingDetails?.integrationFixture?.genuineSandbox!==true||q?.length!==1||q[0].id!==f.quoteId||q[0].amount!==f.amount||q[0].currency!=='BDT'||!q[0].acceptedAt)throw Error('FIXTURE_CREATE_SCOPE');
 scope.reserve('bookings');scope.reserve('passengers');scope.reserve('initialHistory');scope.record({kind:'planned-booking',id:f.bookingId,passengerId:f.passengerId,historyId:f.historyId});
 }else if(method==='update'&&key==='booking'){
 scope.fixture(String(arg.where?.id));if(Object.keys(data||{}).some(k=>k!=='bookingDetails'))throw Error('BOOKING_FULFILLMENT_WRITE_FORBIDDEN');scope.reserve('bookingUpdates');
 }else if(method==='create'&&key==='bookingStatusHistory'){
 scope.fixture(String(data?.bookingId));if(data.fromStatus!=='PENDING'||data.toStatus!=='PENDING'||data.changedBy!=='SSLCOMMERZ_SANDBOX')throw Error('FULFILLMENT_HISTORY_FORBIDDEN');scope.reserve('financialHistory');scope.record({kind:'planned-history',bookingId:data.bookingId});
 }else if(method==='create'&&key==='notificationOutbox'){
 scope.fixture(String(data?.payload?.params?.referenceNumber));if(!scope.plan.actors.some(a=>a.email===data.recipient)||typeof data.idempotencyKey!=='string'||!data.idempotencyKey.startsWith('gateway:'))throw Error('UNOWNED_OUTBOX_RECIPIENT');scope.reserve('outbox');scope.record({kind:'planned-outbox',idempotencyKey:data.idempotencyKey});
 }else if(!['findMany','findUnique','findFirst','count'].includes(String(method)))throw Error('UNAPPROVED_MODEL_WRITE');
 const result=await Reflect.apply(fn,d,[arg]);
 if(key==='user'&&method==='findMany'&&Array.isArray(result)&&result.some(u=>!scope.plan.actors.some(a=>a.id===u.id)))throw Error('UNLISTED_STAFF_RECIPIENT');
 if(method==='create'&&result&&typeof result==='object'&&'id' in result)scope.record({kind:'created-row',table:key,id:result.id});return result;
 };}});
 }
 const value=Reflect.get(target,key);if(typeof key==='string'&&!key.startsWith('$')&&value&&typeof value==='object')return new Proxy(value,{get(d,method){const fn=Reflect.get(d,method);if(typeof fn!=='function')return fn;return(...args:unknown[])=>{if(!['findMany','findUnique','findFirst','count'].includes(String(method)))throw Error('UNAPPROVED_MODEL_WRITE');return Reflect.apply(fn,d,args);};}});return typeof value==='function'?value.bind(target):value;
 }});}
 return new Proxy(base,{get(target,key){if(key==='$transaction')return (action:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:object)=>{scope.reserve('transactions');return target.$transaction(tx=>action(transaction(tx)),options);};if(key==='$executeRaw'||key==='$executeRawUnsafe')return()=>{throw Error('ROOT_WRITE_FORBIDDEN');};if(typeof key==='string'&&['booking','bookingPassenger','bookingStatusHistory','notificationOutbox','user','session','gatewayPayment','gatewayPaymentEvent','gatewayRefund'].includes(key)){const delegate=Reflect.get(target,key);return new Proxy(delegate,{get(d,method){const v=Reflect.get(d,method);if(typeof v!=='function')return v;return(...args:unknown[])=>{if(!['findMany','findUnique','findUniqueOrThrow','findFirst','count'].includes(String(method)))throw Error('ROOT_WRITE_FORBIDDEN');return Reflect.apply(v,d,args);};}});}const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}});
 }
}
export class OwnedStore implements PaymentStore {
 constructor(private inner:PaymentStore,private scope:Scope){}
 transaction<T>(reference:string,action:(l:Ledger)=>Promise<T>){const f=this.scope.fixture(reference);return this.inner.transaction(reference,l=>{if(l.booking.id!==f.bookingId||l.booking.userId!==f.customerId)throw Error('LOCKED_BOOKING_OWNERSHIP_CHANGED');return action(l);});}
 locate(tranId:string){const p=[...this.scope.payments.values()].find(p=>p.tranId===tranId);return Promise.resolve(p?.fixture.reference||null);}
 due(){throw Error('BACKGROUND_RECONCILIATION_FORBIDDEN');return Promise.resolve([] as string[]);}
 async operations(){return(await this.inner.operations()).filter(e=>this.scope.plan.fixtures.some(f=>f.reference===e.reference));}
}
export class LimitedGateway implements Gateway {
 constructor(private inner:Gateway,private scope:Scope){}
 async initiate(tranId:string,amount:string,customer:Customer){const p=[...this.scope.payments.values()].find(p=>p.tranId===tranId);if(!p||amount!==String(p.fixture.amount*100)||!customer.email.endsWith('@example.invalid'))throw Error('PROVIDER_SCOPE');this.scope.reserve('initiate');
 // Provider cus_email has a documented 50-character limit. Keep stored actor identity
 // unchanged; send only this short, non-deliverable synthetic billing alias.
 const session=await this.inner.initiate(tranId,amount,{...customer,email:`sandbox-${p.fixture.name}@example.invalid`});
 this.scope.record({kind:'genuine-session',case:p.fixture.name,merchantEnabledChannelGroups:session.channels,sessionPresent:!!session.sessionKey,checkoutPresent:!!session.url});return session;}
 async query(tranId:string){if(![...this.scope.payments.values()].some(p=>p.tranId===tranId))throw Error('PROVIDER_SCOPE');this.scope.reserve('query');const rows=await this.inner.query(tranId);for(const r of rows)if(r.tranId===tranId&&r.valId)this.scope.validations.add(r.valId);return rows;}
 async validate(valId:string){if(!this.scope.validations.has(valId))throw Error('PROVIDER_SCOPE');this.scope.reserve('validate');const r=await this.inner.validate(valId);this.scope.record({kind:'authoritative-validation',status:r.status,amountMinor:r.amountMinor,currency:r.currency,risk:r.risk,transactionOwned:[...this.scope.payments.values()].some(p=>p.tranId===r.tranId),validationIdPresent:!!r.valId,bankIdPresent:!!r.bankId});return r;}
 async refund():Promise<{reference:string;tranId:string}>{throw Error('REFUND_NOT_APPROVED');}
 async refundStatus():Promise<{status:'processing';bankId:string;tranId:string}>{throw Error('REFUND_NOT_APPROVED');}
}
