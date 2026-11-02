// Offline assembly only: exact accepted schema/migration checks, never execute SQL.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../../..'),dir=path.join(root,'server/prisma/migrations');
if(['attempt-started.json','proof-attempt.json','proof-result.json','caller-result.json','readonly-stdout.txt'].some(n=>fs.existsSync(path.join(base,n))))throw Error('EXISTING_ATTEMPT_NO_REBUILD');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const q=s=>"'"+s.replace(/'/g,"''")+"'";
const names=fs.readdirSync(dir).filter(n=>fs.statSync(path.join(dir,n)).isDirectory()).sort();if(names.length!==8)throw Error('EXPECTED_EIGHT_MIGRATIONS');
const migrations=names.map(n=>`(${q(n)},${q(sha(path.join(dir,n,'migration.sql')))})`).join(',\n');
const source=fs.readFileSync(path.join(dir,'20261103000100_gateway_sandbox_ledgers/migration.sql'),'utf8');
const functions=[...source.matchAll(/CREATE FUNCTION public\.(\w+)\(\)[\s\S]*?AS (\$\w+\$)([\s\S]*?)\2;/g)];if(functions.length!==2)throw Error('EXPECTED_TWO_FUNCTION_SOURCES');
const functionChecks=functions.map(m=>`IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=${q(m[1])} AND p.prosrc=${q(m[3])} AND NOT p.prosecdef AND p.prorettype='trigger'::regtype AND has_function_privilege(current_user,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'PHASE3_FUNCTION_BODY_OR_SECURITY_MISMATCH'; END IF;`).join('\n');
const sql=`BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='2000ms';
DO $guard$
DECLARE t text;
BEGIN
 IF current_setting('transaction_read_only')<>'on' OR current_database()<>'flywithsafety_local_integration' OR current_user<>'flywithsafe_phase2_booking_test' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN RAISE EXCEPTION 'PHASE3_RESTRICTED_IDENTITY_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_stat_activity WHERE datid=34701 AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'PHASE3_OTHER_LOCAL_CONNECTION_STOP_NO_TERMINATION'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR NOT rolcanlogin)) OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR has_schema_privilege(current_user,'public','CREATE') THEN RAISE EXCEPTION 'PHASE3_UNSAFE_ROLE'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>8 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) OR EXISTS(SELECT FROM (VALUES ${migrations}) expected(name,checksum) WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.name AND m.checksum=expected.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)) THEN RAISE EXCEPTION 'PHASE3_EIGHT_PINNED_MIGRATIONS_MISMATCH'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund') AND relkind='r')<>3 OR (SELECT count(*) FROM pg_index WHERE indrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND indisvalid AND indisready)<>14 THEN RAISE EXCEPTION 'PHASE3_TABLE_INDEX_MISMATCH'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayRefund"'::regclass) AND NOT tgisinternal AND tgenabled='O')<>2 OR (SELECT count(*) FROM pg_constraint WHERE conrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND contype='f' AND convalidated AND confdeltype='r')<>4 THEN RAISE EXCEPTION 'PHASE3_TRIGGER_OR_FOREIGN_KEY_MISMATCH'; END IF;
 ${functionChecks}
 FOREACH t IN ARRAY ARRAY['GatewayPayment','GatewayPaymentEvent','GatewayRefund'] LOOP
  IF NOT has_table_privilege(current_user,format('public.%I',t),'SELECT') OR NOT has_table_privilege(current_user,format('public.%I',t),'INSERT') OR has_table_privilege(current_user,format('public.%I',t),'DELETE') OR has_table_privilege(current_user,format('public.%I',t),'TRUNCATE') OR has_table_privilege(current_user,format('public.%I',t),'UPDATE') THEN RAISE EXCEPTION 'PHASE3_NEW_TABLE_PRIVILEGE_MISMATCH'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['status','valId','bankId','dueAt','state'] LOOP IF NOT has_column_privilege(current_user,'public."GatewayPayment"',t,'UPDATE') THEN RAISE EXCEPTION 'PHASE3_PAYMENT_COLUMN_PERMISSION_MISSING'; END IF; END LOOP;
 IF NOT has_column_privilege(current_user,'public."GatewayRefund"','state','UPDATE') OR has_any_column_privilege(current_user,'public."GatewayPaymentEvent"','UPDATE') OR has_column_privilege(current_user,'public."GatewayPayment"','tranId','UPDATE') OR has_column_privilege(current_user,'public."GatewayRefund"','paymentId','UPDATE') THEN RAISE EXCEPTION 'PHASE3_COLUMN_PRIVILEGE_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM public."GatewayPayment") OR EXISTS(SELECT FROM public."GatewayPaymentEvent") OR EXISTS(SELECT FROM public."GatewayRefund") THEN RAISE EXCEPTION 'PHASE3_PAYMENT_LEDGER_NOT_FRESH_STOP'; END IF;
END;
$guard$;
SELECT 'PHASE3_RESTRICTED_READONLY_SCHEMA_ACCESS_PASS';
SELECT current_database() AS database_name,current_user AS role_name;
ROLLBACK;
`;
fs.writeFileSync(path.join(base,'preflight.readonly.sql'),sql);console.log({prepared:true,databaseExecuted:false,migrations:names.length,functionBodies:functions.length});
