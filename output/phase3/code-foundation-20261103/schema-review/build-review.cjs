// Offline package assembly only. No database/provider process is invoked.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = __dirname, root = path.resolve(base, '../../../..');
if (['attempt.json','stdout.txt','result.json'].some(f=>fs.existsSync(path.join(base,f)))) throw Error('EXISTING_ATTEMPT_DO_NOT_REBUILD');
const migrationName = '20261103000100_gateway_sandbox_ledgers', migrations = path.join(root,'server/prisma/migrations');
const names = fs.readdirSync(migrations).filter(n=>fs.statSync(path.join(migrations,n)).isDirectory() && n!==migrationName);
if(names.length!==7) throw Error('EXPECTED_SEVEN_BASELINE_FILES');
const sha = p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const migration = path.join(migrations,migrationName,'migration.sql'), access=path.join(base,'../restricted-access.review.sql');
const expected = names.sort().map(n=>`('${n}','${sha(path.join(migrations,n,'migration.sql')).toLowerCase()}')`).join(',\n');
const noTx = text=>{if((text.match(/^BEGIN;$/gm)||[]).length!==1||(text.match(/^COMMIT;$/gm)||[]).length!==1)throw Error('EXPECTED_EXPLICIT_TRANSACTION');return text.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');};
const namesSql = `'GatewayPayment','GatewayPaymentEvent','GatewayRefund'`;
const metadata = `SELECT md5(coalesce(string_agg(row(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),c.relowner,c.relacl)::text,E'\\n' ORDER BY c.relname,a.attnum),'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN (${namesSql})`;
const counts = `FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN (${namesSql},'_prisma_migrations') ORDER BY c.relname LOOP EXECUTE format('SELECT count(*) FROM public.%I',r.relname) INTO amount; counts:=counts||jsonb_build_object(r.relname,amount); END LOOP;`;
const sql = `-- Prepared only; one administrator connection, no reconnects/provider/business fixtures.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record; amount bigint; counts jsonb:='{}'; signature text;
BEGIN
 IF current_user<>'postgres' OR current_database()<>'flywithsafety_local_integration' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN RAISE EXCEPTION 'PHASE3_LOCAL_IDENTITY_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_stat_activity WHERE datid=34701 AND pid<>pg_backend_pid() AND backend_type='client backend') THEN RAISE EXCEPTION 'PHASE3_OTHER_LOCAL_CONNECTION_STOP_NO_TERMINATION'; END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test')) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_ROLE_MEMBERSHIP'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${namesSql})) OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('gateway_payment_immutable','gateway_refund_reserve')) THEN RAISE EXCEPTION 'PHASE3_NEW_OBJECT_ALREADY_PRESENT_NO_RETRY'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) OR EXISTS(SELECT FROM public._prisma_migrations WHERE migration_name='${migrationName}') THEN RAISE EXCEPTION 'PHASE3_MIGRATION_PRESTATE_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM (VALUES ${expected}) e(name,checksum) WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=e.name AND m.checksum=e.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)) THEN RAISE EXCEPTION 'PHASE3_BASELINE_CHECKSUM_MISMATCH'; END IF;
 ${counts}
 PERFORM set_config('phase3.baseline_counts',counts::text,false);
 SELECT (${metadata}) INTO signature;
 PERFORM set_config('phase3.baseline_metadata',signature,false);
END;
$preflight$;
${noTx(fs.readFileSync(migration,'utf8'))}
${noTx(fs.readFileSync(access,'utf8'))}
INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(gen_random_uuid()::text,'${sha(migration).toLowerCase()}',clock_timestamp(),'${migrationName}',clock_timestamp(),1);
DO $post$
DECLARE r record; amount bigint; counts jsonb:='{}'; signature text;
BEGIN
 ${counts}
 SELECT (${metadata}) INTO signature;
 IF counts<>current_setting('phase3.baseline_counts')::jsonb OR signature<>current_setting('phase3.baseline_metadata') THEN RAISE EXCEPTION 'PHASE3_EXISTING_RECORD_OR_SCHEMA_ACCESS_DRIFT'; END IF;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${namesSql}) AND a.grantee=0) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_PUBLIC_TABLE_ACCESS'; END IF;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${namesSql}) AND a.grantee<>c.relowner AND (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test') OR a.is_grantable OR a.privilege_type NOT IN ('SELECT','INSERT'))) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_NEW_TABLE_GRANTEE'; END IF;
 FOREACH signature IN ARRAY ARRAY[${namesSql}] LOOP
  IF NOT has_table_privilege('flywithsafe_phase2_booking_test',format('public.%I',signature),'SELECT') OR NOT has_table_privilege('flywithsafe_phase2_booking_test',format('public.%I',signature),'INSERT') OR has_table_privilege('flywithsafe_phase2_booking_test',format('public.%I',signature),'DELETE') OR has_table_privilege('flywithsafe_phase2_booking_test',format('public.%I',signature),'TRUNCATE') OR has_table_privilege('flywithsafe_phase2_booking_test',format('public.%I',signature),'TRIGGER') THEN RAISE EXCEPTION 'PHASE3_NEW_TABLE_ACCESS_MISMATCH'; END IF;
 END LOOP;
 IF has_any_column_privilege('flywithsafe_phase2_booking_test','public."GatewayPaymentEvent"','UPDATE') OR has_column_privilege('flywithsafe_phase2_booking_test','public."GatewayPayment"','tranId','UPDATE') OR has_column_privilege('flywithsafe_phase2_booking_test','public."GatewayRefund"','paymentId','UPDATE') OR has_schema_privilege('flywithsafe_phase2_booking_test','public','CREATE') THEN RAISE EXCEPTION 'PHASE3_EXCESS_UPDATE_OR_DDL_ACCESS'; END IF;
 IF NOT has_column_privilege('flywithsafe_phase2_booking_test','public."GatewayPayment"','state','UPDATE') OR NOT has_column_privilege('flywithsafe_phase2_booking_test','public."GatewayRefund"','state','UPDATE') THEN RAISE EXCEPTION 'PHASE3_REQUIRED_UPDATE_ACCESS_MISSING'; END IF;
END;
$post$;
COMMIT;
SELECT 'PHASE3_ADDITIVE_SCHEMA_COMMITTED';
BEGIN READ ONLY;
DO $final$
DECLARE r record; amount bigint; counts jsonb:='{}'; signature text;
BEGIN
 IF (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 OR (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>8 OR EXISTS(SELECT FROM public."GatewayPayment") OR EXISTS(SELECT FROM public."GatewayPaymentEvent") OR EXISTS(SELECT FROM public."GatewayRefund") THEN RAISE EXCEPTION 'PHASE3_FINAL_CATALOG_OR_EMPTY_LEDGER_MISMATCH'; END IF;
 ${counts}
 SELECT (${metadata}) INTO signature;
 IF counts<>current_setting('phase3.baseline_counts')::jsonb OR signature<>current_setting('phase3.baseline_metadata') THEN RAISE EXCEPTION 'PHASE3_FINAL_BASELINE_PRESERVATION_MISMATCH'; END IF;
END;
$final$;
SELECT 'PHASE3_SCHEMA_FINAL_READONLY_PRESERVATION_PASS';
ROLLBACK;
`;
fs.writeFileSync(path.join(base,'apply.review.sql'),sql);
const files=[migration,access,path.join(base,'apply.review.sql'),path.join(root,'server/prisma/schema.prisma'),...names.map(n=>path.join(migrations,n,'migration.sql')),...fs.readdirSync(path.join(root,'server/src/payments')).map(n=>path.join(root,'server/src/payments',n)),path.join(root,'output/database/local-rename-preparation-20261102-01/result.json'),path.join(root,'output/database/local-rename-closure-20261102/rename-acceptance.json')];
const pins=files.map(p=>({path:p,sha256:sha(p)})); fs.writeFileSync(path.join(base,'pins.json'),JSON.stringify(pins,null,2));
const caller=path.join(base,'Invoke-Phase3Schema.ps1');
let ps=fs.readFileSync(caller,'utf8');ps=ps.replace(/-cne '(?:__MANIFEST_SHA__|[A-F0-9]{64})'\)\{throw 'STOP: Phase3 schema manifest mismatch'/,`-cne '${sha(path.join(base,'pins.json'))}')\{throw 'STOP: Phase3 schema manifest mismatch'`);
fs.writeFileSync(caller,ps);
fs.writeFileSync(path.join(base,'review-hashes.json'),JSON.stringify({callerSha256:sha(caller),migrationSha256:sha(migration),executionSqlSha256:sha(path.join(base,'apply.review.sql')),pins:pins.length,approved:false,databaseExecuted:false},null,2));
console.log({pins:pins.length,callerSha256:sha(caller),databaseExecuted:false});
