import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plan } from './scope.js';
export function assertLocalURL(value:string){const u=new URL(value);if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||u.port!=='5432'||u.pathname!=='/flywithsafety_local_integration'||u.username!=='flywithsafe_phase2_booking_test'||!u.password||u.search||u.hash)throw Error('LOCAL_RESTRICTED_DB_REQUIRED');}
export async function preflight(db:PrismaClient,plan:Plan,repo:string){
 assertLocalURL(process.env.DATABASE_URL||'');
 const rows=await db.$queryRawUnsafe<Array<{db:string;role:string;oid:number;host:string;port:number}>>('SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS host,inet_server_port() AS port');
 if(rows.length!==1||rows[0].db!=='flywithsafety_local_integration'||rows[0].role!=='flywithsafe_phase2_booking_test'||rows[0].oid!==34701||rows[0].host!=='127.0.0.1'||rows[0].port!==5432)throw Error('LIVE_IDENTITY_MISMATCH');
 const migrations=await db.$queryRawUnsafe<Array<{migration_name:string;checksum:string;finished:boolean;rolled:boolean}>>('SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled FROM public._prisma_migrations ORDER BY migration_name');
 const dir=resolve(repo,'server/prisma/migrations');const local=readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>({name:d.name,checksum:createHash('sha256').update(readFileSync(resolve(dir,d.name,'migration.sql'))).digest('hex')}));
 if(local.length!==8||migrations.length!==8||!local.every(m=>migrations.some(r=>r.migration_name===m.name&&r.checksum===m.checksum&&r.finished&&!r.rolled)))throw Error('MIGRATION_HISTORY_MISMATCH');
 const users=await db.user.findMany({where:{id:{in:plan.actors.map(a=>a.id)}},select:{id:true,email:true,role:true,emailVerified:true}});
 if(users.length!==4||!plan.actors.every(a=>users.some(u=>u.id===a.id&&u.email===a.email&&u.role===a.role&&u.emailVerified)))throw Error('EXACT_ACTORS_REQUIRED');
 const staff=await db.user.findMany({where:{role:{in:['STAFF','ADMIN']}},select:{id:true}});
 if(staff.length!==2||staff.some(u=>!plan.actors.some(a=>a.id===u.id&&['STAFF','ADMIN'].includes(a.role))))throw Error('UNLISTED_NOTIFICATION_RECIPIENT');
 if(await db.booking.count({where:{OR:[{id:{in:plan.fixtures.map(f=>f.bookingId)}},{referenceNumber:{in:plan.fixtures.map(f=>f.reference)}}]}}))throw Error('FIXTURE_PREEXISTS_NO_RETRY');
 const privileges=await db.$queryRawUnsafe<Array<{ok:boolean}>>(`SELECT has_database_privilege(current_user,current_database(),'CONNECT') AND has_table_privilege(current_user,'public."Booking"','INSERT') AND has_table_privilege(current_user,'public."BookingPassenger"','INSERT') AND has_table_privilege(current_user,'public."BookingStatusHistory"','INSERT') AND has_table_privilege(current_user,'public."NotificationOutbox"','INSERT') AND has_table_privilege(current_user,'public."GatewayPayment"','INSERT') AND has_table_privilege(current_user,'public."GatewayPaymentEvent"','INSERT') AND has_column_privilege(current_user,'public."Booking"','bookingDetails','UPDATE') AND NOT (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS ok`);
 if(privileges[0]?.ok!==true)throw Error('RESTRICTED_PERMISSIONS_MISMATCH');
 const paymentAccess=await db.$queryRawUnsafe<Array<{ok:boolean}>>(`SELECT has_table_privilege(current_user,'public."GatewayPayment"','SELECT') AND has_table_privilege(current_user,'public."GatewayRefund"','SELECT') AND has_table_privilege(current_user,'public."GatewayPaymentEvent"','SELECT') AND NOT EXISTS(SELECT FROM unnest(ARRAY['status','valId','bankId','dueAt','state']) c WHERE NOT has_column_privilege(current_user,'public."GatewayPayment"',c,'UPDATE')) AND (SELECT count(*)=2 FROM pg_trigger WHERE tgrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayRefund"'::regclass) AND tgname IN ('gateway_payment_immutable','gateway_refund_reserve') AND tgenabled='O' AND NOT tgisinternal) AS ok`);
 if(paymentAccess[0]?.ok!==true)throw Error('PAYMENT_ACCESS_OR_TRIGGER_MISMATCH');
 return{identityVerified:true,migrations:8,actors:4,staffRecipients:2,fixtureAbsent:true};
}
export async function preserve(db:PrismaClient,plan:Plan){
 // Rows are compared only in memory. No unrelated data/passwords/tokens are written to artifacts.
 return {
 migrations:await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name'),
 catalog:await db.$queryRawUnsafe("SELECT c.relname,c.relkind,c.relowner,c.relacl::text,a.attnum,a.attname,a.atttypid,a.attnotnull FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='public' ORDER BY c.relname,a.attnum"),
 role:await db.$queryRawUnsafe('SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname=current_user'),
 users:await db.user.findMany({select:{id:true,email:true,role:true,updatedAt:true},orderBy:{id:'asc'}}),
 sessions:await db.session.findMany({select:{id:true,userId:true,revokedAt:true,expiresAt:true},orderBy:{id:'asc'}}),
 bookings:await db.booking.findMany({where:{id:{notIn:plan.fixtures.map(f=>f.bookingId)}},orderBy:{id:'asc'}}),
 passengers:await db.bookingPassenger.findMany({where:{bookingId:{notIn:plan.fixtures.map(f=>f.bookingId)}},orderBy:{id:'asc'}}),
 history:await db.bookingStatusHistory.findMany({where:{bookingId:{notIn:plan.fixtures.map(f=>f.bookingId)}},orderBy:{id:'asc'}}),
 paymentRows:await db.$queryRawUnsafe(`SELECT to_jsonb(p) AS data FROM public."GatewayPayment" p WHERE p."bookingId" NOT IN (${plan.fixtures.map((_,i)=>'$'+(i+1)).join(',')}) ORDER BY id`,...plan.fixtures.map(f=>f.bookingId)),
 // Preexisting event/refund/outbox rows cannot be updated by scoped DB. Capture stable IDs/status, no secret data.
 refunds:await db.$queryRawUnsafe('SELECT id,"paymentId" FROM public."GatewayRefund" ORDER BY id'),
 events:await db.$queryRawUnsafe(`SELECT e.id,e."paymentId",e.kind,e.actor FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId" NOT IN (${plan.fixtures.map((_,i)=>'$'+(i+1)).join(',')}) ORDER BY e.id`,...plan.fixtures.map(f=>f.bookingId)),
 outbox:await db.notificationOutbox.findMany({where:{NOT:{OR:plan.fixtures.map(f=>({payload:{path:['params','referenceNumber'],equals:f.reference}}))}},select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}}),
 };
}
