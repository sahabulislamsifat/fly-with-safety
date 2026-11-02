const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),base='output/phase2/exact-cleanup-20261102-01';if(fs.existsSync(base))throw Error('REVIEW_EXISTS');fs.mkdirSync(base);
const snapshot=JSON.parse(fs.readFileSync('output/phase2/sameports-browser-20261102-02/retained-records.json'));
const actorRows=fs.readFileSync('output/phase2/integration-recovery-20261101-01/fixture-ledger.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse).filter(x=>x.kind==='created-user');
const expected={users:4,sessions:14,bookings:2,passengers:2,history:5,notifications:4,idempotency:2};for(const [k,n]of Object.entries(expected))if(snapshot[k]?.length!==n)throw Error('LEDGER_COUNT_'+k);
const ids=k=>snapshot[k].map(x=>x.id),lit=s=>"'"+String(s).replaceAll("'","''")+"'",arr=a=>'ARRAY['+a.map(lit).join(',')+']::text[]';
for(const k of Object.keys(expected))if(ids(k).some(x=>! /^[a-z0-9-]+$/i.test(x)))throw Error('UNSAFE_ID');
const users=ids('users'),bookingIds=ids('bookings'),refs=snapshot.bookings.map(x=>x.referenceNumber),emails=users.map(x=>x+'@example.invalid');
if(snapshot.bookings.some(x=>x.userId!==users[0])||!refs.includes('FWS-2026-53YFS3')||!refs.includes('FWS-2026-5LA6DA'))throw Error('BOOKING_BINDING');
const sourceRole=fs.readFileSync('output/phase2/setup-review/role.sql','utf8'),roleGuard=[...sourceRole.matchAll(/DO \$guard\$[\s\S]*?END \$guard\$;/g)].at(-1)?.[0];if(!roleGuard||!roleGuard.includes('EXACT_COLUMN_MATRIX_FAILED')||/\b(?:GRANT|REVOKE|ALTER|CREATE ROLE)\b/.test(roleGuard))throw Error('ROLE_GUARD_EXTRACTION');
const migrationRows=fs.readdirSync('server/prisma/migrations',{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>[e.name,crypto.createHash('sha256').update(fs.readFileSync('server/prisma/migrations/'+e.name+'/migration.sql')).digest('hex')]);
const targetGuard=`DO $target$ BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'postgres'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'EXACT_CLEANUP_WRONG_LOCAL_TARGET_OR_ADMIN'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 OR EXISTS(SELECT FROM (VALUES ${migrationRows.map(r=>'('+r.map(lit).join(',')+')').join(',')}) AS expected(migration_name,checksum)
 WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.migration_name AND m.checksum=expected.checksum)) THEN RAISE EXCEPTION 'EXACT_CLEANUP_MIGRATION_MISMATCH'; END IF;
END $target$;`;
const catalog=`SELECT md5(jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(catalog_column) ORDER BY catalog_column.relname,catalog_column.attnum) FROM (SELECT c.relname,c.relkind,c.relowner,c.relacl::text,c.relrowsecurity,a.attnum,a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN('r','p')) catalog_column),
 'constraints',(SELECT jsonb_agg(to_jsonb(catalog_constraint) ORDER BY catalog_constraint.conrelid,catalog_constraint.conname) FROM (SELECT conrelid,conname,contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace) catalog_constraint),
 'indexes',(SELECT jsonb_agg(to_jsonb(catalog_index) ORDER BY catalog_index.indexname) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public') catalog_index),
 'enums',(SELECT jsonb_agg(to_jsonb(catalog_enum) ORDER BY catalog_enum.typname,catalog_enum.enumsortorder) FROM (SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace) catalog_enum),
 'roles',(SELECT jsonb_agg(to_jsonb(role_attribute) ORDER BY role_attribute.rolname) FROM (SELECT oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles) role_attribute),
 'memberships',(SELECT jsonb_agg(to_jsonb(role_member) ORDER BY role_member.roleid,role_member.member) FROM (SELECT roleid,member,grantor,admin_option FROM pg_auth_members) role_member),
 'databases',(SELECT jsonb_agg(to_jsonb(database_access) ORDER BY database_access.datname) FROM (SELECT oid,datname,datdba,datacl::text FROM pg_database) database_access),
 'schema_access',(SELECT jsonb_agg(to_jsonb(schema_access) ORDER BY schema_access.nspname) FROM (SELECT nspname,nspowner,nspacl::text FROM pg_namespace WHERE nspname='public') schema_access)
 )::text)`;
const unowned=`SELECT md5(jsonb_build_object(
 'users',(SELECT jsonb_agg(jsonb_build_array(id,role,"emailVerified","createdAt","updatedAt") ORDER BY id) FROM public."User" WHERE NOT(id=ANY(user_ids))),
 'sessions',(SELECT jsonb_agg(jsonb_build_array(id,"userId","expiresAt","revokedAt","lastUsedAt") ORDER BY id) FROM public."Session" WHERE NOT(id=ANY(session_ids))),
 'bookings',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber",status,"totalPrice",currency,"updatedAt") ORDER BY id) FROM public."Booking" WHERE NOT(id=ANY(booking_ids))),
 'passengers',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId") ORDER BY id) FROM public."BookingPassenger" WHERE NOT(id=ANY(passenger_ids))),
 'history',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId","fromStatus","toStatus") ORDER BY id) FROM public."BookingStatusHistory" WHERE NOT(id=ANY(history_ids))),
 'idempotency',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber") ORDER BY id) FROM public."IdempotencyRecord" WHERE NOT(id=ANY(idempotency_ids))),
 'outbox',(SELECT jsonb_agg(jsonb_build_array(id,recipient,status,attempts) ORDER BY id) FROM public."NotificationOutbox" WHERE NOT(id=ANY(notification_ids)))
 )::text)`;
const tables={NotificationOutbox:['notifications',4],BookingStatusHistory:['history',5],BookingPassenger:['passengers',2],IdempotencyRecord:['idempotency',2],Session:['sessions',14],Booking:['bookings',2],User:['users',4]};
const varnames={notifications:'notification_ids',history:'history_ids',passengers:'passenger_ids',idempotency:'idempotency_ids',sessions:'session_ids',bookings:'booking_ids',users:'user_ids'};
let guards='';for(const [table,[k,n]]of Object.entries(tables)){guards+=` IF cardinality(${varnames[k]})<>${n} OR (SELECT count(DISTINCT v) FROM unnest(${varnames[k]})v)<>${n} OR (SELECT count(*) FROM public."${table}" WHERE id=ANY(${varnames[k]}))<>${n} THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_${table}'; END IF;\n`;}
for(const a of actorRows)guards+=` IF NOT EXISTS(SELECT FROM public."User" WHERE id=${lit(a.userId)} AND email=${lit(a.email)} AND role::text=${lit(a.role)} AND name='Synthetic Phase2' AND "emailVerified" AND length(password)=60 AND left(password,7) IN('$2a$12$','$2b$12$','$2y$12$')) THEN RAISE EXCEPTION 'OWNED_USER_BINDING_MISMATCH'; END IF;\n`;
for(const b of snapshot.bookings)guards+=` IF NOT EXISTS(SELECT FROM public."Booking" WHERE id=${lit(b.id)} AND "referenceNumber"=${lit(b.referenceNumber)} AND "userId"=${lit(b.userId)} AND "customerEmail"=${lit(b.userId+'@example.invalid')} AND status::text=${lit(b.status)} AND "totalPrice"=${b.totalPrice} AND currency=${lit(b.currency)} AND "bookingDetails" IS NOT DISTINCT FROM ${lit(JSON.stringify(b.bookingDetails))}::jsonb) THEN RAISE EXCEPTION 'OWNED_BOOKING_STATE_MISMATCH'; END IF;\n`;
for(const s of snapshot.sessions)guards+=` IF NOT EXISTS(SELECT FROM public."Session" WHERE id=${lit(s.id)} AND "userId"=${lit(s.userId)}) THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;\n`;
for(const p of snapshot.passengers){const fresh=p.bookingId===snapshot.bookings.find(b=>b.referenceNumber==='FWS-2026-5LA6DA').id;guards+=` IF NOT EXISTS(SELECT FROM public."BookingPassenger" WHERE id=${lit(p.id)} AND "bookingId"=${lit(p.bookingId)} AND "firstName"='Synthetic' AND "lastName"=${lit(fresh?'RetryTraveller':'Traveller')} AND "passportNumber" IS NULL AND "dateOfBirth" IS NULL) THEN RAISE EXCEPTION 'OWNED_PASSENGER_BINDING_MISMATCH'; END IF;\n`;}
for(const h of snapshot.history)guards+=` IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id=${lit(h.id)} AND "bookingId"=${lit(h.bookingId)} AND "fromStatus"::text=${lit(h.fromStatus)} AND "toStatus"::text=${lit(h.toStatus)}) THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;\n`;
for(const r of snapshot.idempotency)guards+=` IF NOT EXISTS(SELECT FROM public."IdempotencyRecord" WHERE id=${lit(r.id)} AND "referenceNumber"=${lit(r.referenceNumber)} AND "userId"=${lit(users[0])} AND operation='booking:create' AND principal=${lit('user:'+users[0])}) THEN RAISE EXCEPTION 'OWNED_IDEMPOTENCY_BINDING_MISMATCH'; END IF;\n`;
guards+=` IF (SELECT count(*) FROM public."Session" WHERE "userId"=ANY(user_ids))<>14 OR (SELECT count(*) FROM public."Booking" WHERE "userId"=ANY(user_ids) OR "customerEmail"=ANY(user_emails))<>2 OR (SELECT count(*) FROM public."BookingPassenger" WHERE "bookingId"=ANY(booking_ids))<>2 OR (SELECT count(*) FROM public."BookingStatusHistory" WHERE "bookingId"=ANY(booking_ids))<>5 OR (SELECT count(*) FROM public."IdempotencyRecord" WHERE "userId"=ANY(user_ids) OR "referenceNumber"=ANY(booking_refs))<>2 OR (SELECT count(*) FROM public."NotificationOutbox" WHERE recipient=ANY(user_emails))<>4 THEN RAISE EXCEPTION 'UNEXPECTED_EXTRA_OWNED_RECORDS'; END IF;
 IF EXISTS(SELECT FROM public."NotificationOutbox" WHERE id=ANY(notification_ids) AND (recipient<>ALL(user_emails) OR template NOT IN('BOOKING_CONFIRMATION','BOOKING_STATUS') OR NOT(coalesce(params->>'referenceNumber','')=ANY(booking_refs)) OR status::text='PROCESSING')) THEN RAISE EXCEPTION 'OUTBOX_OWNERSHIP_OR_ACTIVE_CLAIM_MISMATCH'; END IF;
`;
for(const t of ['Account','EmailVerificationToken','PasswordResetToken','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry'])guards+=` IF EXISTS(SELECT FROM public."${t}" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_${t}'; END IF;\n`;
let deletes='';for(const [table,[k,n]]of Object.entries(tables)){deletes+=` DELETE FROM public."${table}" WHERE id=ANY(${varnames[k]}); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>${n} THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_${table}'; END IF; RAISE NOTICE 'PHASE2_DELETED_${table}=%',affected;\n`;}
const sql=`\\set ON_ERROR_STOP on
\\pset pager off
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
${targetGuard}
${roleGuard}
DO $cleanup$
DECLARE
 ${Object.entries(varnames).map(([k,v])=>v+' text[] := '+arr(ids(k))+';').join('\n ')}
 user_emails text[] := ${arr(emails)};
 booking_refs text[] := ${arr(refs)};
 before_catalog text;after_catalog text;before_unowned text;after_unowned text;
 before_counts jsonb := '{}'::jsonb; current_count bigint; affected bigint; target_table record;
 expected_deletes jsonb := ${lit(JSON.stringify(Object.fromEntries(Object.entries(tables).map(([t,[k,n]])=>[t,n]))))}::jsonb;
BEGIN
 LOCK TABLE ${Object.keys(tables).map(t=>'public."'+t+'"').join(',')} IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT FROM pg_inherits WHERE inhparent IN('public."User"'::regclass,'public."Session"'::regclass,'public."Booking"'::regclass,'public."BookingPassenger"'::regclass,'public."BookingStatusHistory"'::regclass,'public."IdempotencyRecord"'::regclass,'public."NotificationOutbox"'::regclass) OR inhrelid IN('public."User"'::regclass,'public."Session"'::regclass,'public."Booking"'::regclass,'public."BookingPassenger"'::regclass,'public."BookingStatusHistory"'::regclass,'public."IdempotencyRecord"'::regclass,'public."NotificationOutbox"'::regclass)) THEN RAISE EXCEPTION 'UNREVIEWED_TABLE_INHERITANCE'; END IF;
 PERFORM id FROM public."User" WHERE id=ANY(user_ids) FOR UPDATE;
 PERFORM id FROM public."Booking" WHERE id=ANY(booking_ids) FOR UPDATE;
 IF EXISTS(SELECT FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY(ARRAY[${Object.keys(tables).map(t=>lit('public."'+t+'"')+'::regclass').join(',')}])) THEN RAISE EXCEPTION 'UNREVIEWED_DELETE_TRIGGER'; END IF;
 IF EXISTS(SELECT FROM pg_constraint fk WHERE fk.contype='f' AND fk.confrelid IN('public."User"'::regclass,'public."Booking"'::regclass) AND (cardinality(fk.conkey)<>1 OR cardinality(fk.confkey)<>1 OR NOT EXISTS(SELECT FROM pg_attribute att WHERE att.attrelid=fk.confrelid AND att.attnum=fk.confkey[1] AND att.attname='id') OR NOT EXISTS(SELECT FROM pg_class child JOIN pg_attribute att ON att.attrelid=child.oid AND att.attnum=fk.conkey[1] WHERE child.oid=fk.conrelid AND child.relnamespace='public'::regnamespace AND ((fk.confrelid='public."User"'::regclass AND child.relname IN('Account','EmailVerificationToken','PasswordResetToken','Session','Booking','IdempotencyRecord','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry') AND att.attname='userId') OR (fk.confrelid='public."Booking"'::regclass AND child.relname IN('BookingPassenger','BookingStatusHistory') AND att.attname='bookingId'))))) THEN RAISE EXCEPTION 'UNREVIEWED_FOREIGN_KEY'; END IF;
${guards}
 ${catalog} INTO before_catalog;
 ${unowned} INTO before_unowned;
 FOR target_table IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') ORDER BY relname LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',target_table.relname) INTO current_count;
  before_counts:=before_counts||jsonb_build_object(target_table.relname,current_count);
 END LOOP;
${deletes}
 ${catalog} INTO after_catalog;
 ${unowned} INTO after_unowned;
 IF before_catalog IS DISTINCT FROM after_catalog OR before_unowned IS DISTINCT FROM after_unowned THEN RAISE EXCEPTION 'CATALOG_ACCESS_OR_UNOWNED_PRESERVATION_FAILED'; END IF;
 FOR target_table IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') ORDER BY relname LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',target_table.relname) INTO current_count;
  IF current_count IS DISTINCT FROM ((before_counts->>target_table.relname)::bigint-coalesce((expected_deletes->>target_table.relname)::bigint,0)) THEN RAISE EXCEPTION 'UNEXPECTED_TABLE_COUNT_DELTA'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM public."User" WHERE id=ANY(user_ids)) OR EXISTS(SELECT FROM public."Session" WHERE "userId"=ANY(user_ids)) OR EXISTS(SELECT FROM public."Booking" WHERE id=ANY(booking_ids) OR "userId"=ANY(user_ids) OR "customerEmail"=ANY(user_emails)) OR EXISTS(SELECT FROM public."NotificationOutbox" WHERE recipient=ANY(user_emails)) OR EXISTS(SELECT FROM public."IdempotencyRecord" WHERE "userId"=ANY(user_ids) OR "referenceNumber"=ANY(booking_refs)) THEN RAISE EXCEPTION 'OWNED_GRAPH_NOT_EMPTY'; END IF;
END $cleanup$;
${roleGuard}
COMMIT;
\\echo PHASE2_EXACT_OWNED_CLEANUP_COMMITTED_33_ROWS
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
${targetGuard}
${roleGuard}
DO $final$ BEGIN
 IF EXISTS(SELECT FROM public."User" WHERE id=ANY(${arr(users)})) OR EXISTS(SELECT FROM public."Booking" WHERE id=ANY(${arr(bookingIds)})) OR EXISTS(SELECT FROM public."Session" WHERE "userId"=ANY(${arr(users)})) OR EXISTS(SELECT FROM public."NotificationOutbox" WHERE recipient=ANY(${arr(emails)})) OR EXISTS(SELECT FROM public."IdempotencyRecord" WHERE "referenceNumber"=ANY(${arr(refs)})) THEN RAISE EXCEPTION 'FINAL_OWNED_STATE_NOT_EMPTY'; END IF;
END $final$;
SELECT (SELECT count(*) FROM public."User") AS preserved_unlisted_users, (SELECT count(*) FROM public."Session") AS preserved_unlisted_sessions, (SELECT count(*) FROM public."Booking") AS remaining_unlisted_bookings, (SELECT count(*) FROM public."NotificationOutbox") AS remaining_unlisted_notifications;
ROLLBACK;
\\echo PHASE2_CLEANUP_CATALOG_ACCESS_AND_FINAL_READONLY_PASS
`;
fs.writeFileSync(base+'/cleanup.review.sql',sql);
const scope={expectedRows:33,counts:Object.fromEntries(Object.entries(tables).map(([t,[k,n]])=>[t,n])),ids:Object.fromEntries(Object.entries(tables).map(([t,[k]])=>[t,ids(k)])),unknownUsers:'ALL unlisted IDs preserved, including five baseline extras and any later non-ledger account',commercialJsonRemovedWithOwnedBooking:{quotations:3,payments:1,receipts:5},target:'127.0.0.1:5432/flywithsafe_phase2_booking_integration',privilegedRole:'postgres',databaseExecuted:false};fs.writeFileSync(base+'/exact-ledger.json',JSON.stringify(scope,null,2));console.log(JSON.stringify({prepared:true,expectedRows:33,sqlStatementsNotExecuted:true,counts:scope.counts}));
