-- Prepared only; one administrator connection, no reconnects/provider/business fixtures.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record; amount bigint; counts jsonb:='{}'; signature text;
BEGIN
 IF current_user<>'postgres' OR current_database()<>'flywithsafety_local_integration' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN RAISE EXCEPTION 'PHASE3_LOCAL_IDENTITY_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_stat_activity WHERE datid=34701 AND pid<>pg_backend_pid() AND backend_type='client backend') THEN RAISE EXCEPTION 'PHASE3_OTHER_LOCAL_CONNECTION_STOP_NO_TERMINATION'; END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test')) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_ROLE_MEMBERSHIP'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund')) OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('gateway_payment_immutable','gateway_refund_reserve')) THEN RAISE EXCEPTION 'PHASE3_NEW_OBJECT_ALREADY_PRESENT_NO_RETRY'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) OR EXISTS(SELECT FROM public._prisma_migrations WHERE migration_name='20261103000100_gateway_sandbox_ledgers') THEN RAISE EXCEPTION 'PHASE3_MIGRATION_PRESTATE_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),
('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),
('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),
('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),
('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),
('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),
('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) e(name,checksum) WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=e.name AND m.checksum=e.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)) THEN RAISE EXCEPTION 'PHASE3_BASELINE_CHECKSUM_MISMATCH'; END IF;
 FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund','_prisma_migrations') ORDER BY c.relname LOOP EXECUTE format('SELECT count(*) FROM public.%I',r.relname) INTO amount; counts:=counts||jsonb_build_object(r.relname,amount); END LOOP;
 PERFORM set_config('phase3.baseline_counts',counts::text,false);
 SELECT (SELECT md5(coalesce(string_agg(row(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),c.relowner,c.relacl)::text,E'\n' ORDER BY c.relname,a.attnum),'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund')) INTO signature;
 PERFORM set_config('phase3.baseline_metadata',signature,false);
END;
$preflight$;
-- PREPARED ONLY. Not applied to local or cloud. Additional checks/partial index intentionally exceed Prisma's expressible schema.

CREATE TABLE public."GatewayPayment" (
 id text PRIMARY KEY, "bookingId" text NOT NULL REFERENCES public."Booking"(id) ON DELETE RESTRICT,
 "userId" text NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 "requestId" text NOT NULL, "tranId" varchar(30) NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN ('INITIATING','SESSION_READY','UNKNOWN','VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW','FAILED','CANCELLED','EXPIRED')),
 "valId" text UNIQUE, "bankId" text UNIQUE, "dueAt" timestamptz, state jsonb NOT NULL,
 UNIQUE("userId","requestId"),
 CHECK(jsonb_typeof(state)='object' AND state @> jsonb_build_object('id',id,'bookingId',"bookingId",'userId',"userId",'requestId',"requestId",'tranId',"tranId",'status',status,'currency','BDT')),
 CHECK(state ?& ARRAY['id','bookingId','userId','requestId','tranId','status','currency','amountMinor','captured','quoteId','quoteRevision','digest','checks','due','created','updated']),
 CHECK(jsonb_typeof(state->'amountMinor')='string' AND state->>'amountMinor' ~ '^[1-9][0-9]{0,9}$' AND (state->>'amountMinor')::bigint BETWEEN 1 AND 9999999999),
 CHECK(jsonb_typeof(state->'captured')='boolean'),
 CHECK((status IN ('VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW'))=(state->>'captured')::boolean),
 CHECK((state->>'valId') IS NOT DISTINCT FROM "valId" AND (state->>'bankId') IS NOT DISTINCT FROM "bankId"),
 CHECK(NOT (state->>'captured')::boolean OR ("valId" IS NOT NULL AND "bankId" IS NOT NULL AND status IN ('VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW')))
);
CREATE UNIQUE INDEX "GatewayPayment_one_active_booking" ON public."GatewayPayment"("bookingId") WHERE status IN ('INITIATING','SESSION_READY','UNKNOWN');
CREATE INDEX "GatewayPayment_bookingId_idx" ON public."GatewayPayment"("bookingId");
CREATE INDEX "GatewayPayment_dueAt_idx" ON public."GatewayPayment"("dueAt");
CREATE TABLE public."GatewayPaymentEvent" (
 id text PRIMARY KEY, "paymentId" text NOT NULL REFERENCES public."GatewayPayment"(id) ON DELETE RESTRICT,
 kind text NOT NULL, actor text NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "GatewayPaymentEvent_paymentId_createdAt_idx" ON public."GatewayPaymentEvent"("paymentId","createdAt");
CREATE TABLE public."GatewayRefund" (
 id varchar(30) PRIMARY KEY, "paymentId" text NOT NULL REFERENCES public."GatewayPayment"(id) ON DELETE RESTRICT,
 "requestId" text NOT NULL, "actorId" text NOT NULL, state jsonb NOT NULL,
 UNIQUE("actorId","requestId"),
 CHECK(jsonb_typeof(state)='object' AND state @> jsonb_build_object('id',id,'paymentId',"paymentId",'requestId',"requestId",'actorId',"actorId")),
 CHECK(state ?& ARRAY['id','paymentId','requestId','actorId','amountMinor','status','digest','created','updated']),
 CHECK(jsonb_typeof(state->'amountMinor')='string' AND state->>'amountMinor' ~ '^[1-9][0-9]{0,9}$' AND (state->>'amountMinor')::bigint BETWEEN 1 AND 9999999999),
 CHECK(jsonb_typeof(state->'status')='string' AND state->>'status' IN ('INITIATING','UNKNOWN','PROCESSING','REFUNDED','CANCELLED'))
);
CREATE INDEX "GatewayRefund_paymentId_idx" ON public."GatewayRefund"("paymentId");
CREATE UNIQUE INDEX "GatewayRefund_provider_reference_unique" ON public."GatewayRefund"((state->>'reference')) WHERE state->>'reference' IS NOT NULL;
CREATE FUNCTION public.gateway_payment_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $payment$
BEGIN
 IF ROW(NEW.id,NEW."bookingId",NEW."userId",NEW."requestId",NEW."tranId") IS DISTINCT FROM ROW(OLD.id,OLD."bookingId",OLD."userId",OLD."requestId",OLD."tranId")
 OR (NEW.state - ARRAY['status','session','valId','bankId','channel','captured','checks','due','lease','updated']) IS DISTINCT FROM (OLD.state - ARRAY['status','session','valId','bankId','channel','captured','checks','due','lease','updated'])
 OR (OLD."valId" IS NOT NULL AND NEW."valId" IS DISTINCT FROM OLD."valId")
 OR (OLD."bankId" IS NOT NULL AND NEW."bankId" IS DISTINCT FROM OLD."bankId")
 OR ((OLD.state->>'captured')::boolean AND NOT (NEW.state->>'captured')::boolean)
 OR (OLD.status IN ('RISK_REVIEW','EXCEPTION_REVIEW') AND NEW.status='VERIFIED')
 THEN RAISE EXCEPTION 'GATEWAY_IMMUTABLE_IDENTITY_OR_CAPTURE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$payment$;
CREATE TRIGGER gateway_payment_immutable BEFORE UPDATE ON public."GatewayPayment" FOR EACH ROW EXECUTE FUNCTION public.gateway_payment_immutable();
CREATE FUNCTION public.gateway_refund_reserve() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $refund$
DECLARE captured jsonb; reserved bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW."paymentId",NEW."requestId",NEW."actorId") IS DISTINCT FROM ROW(OLD.id,OLD."paymentId",OLD."requestId",OLD."actorId")
  OR (NEW.state - ARRAY['status','reference','updated']) IS DISTINCT FROM (OLD.state - ARRAY['status','reference','updated'])
  OR (OLD.state->>'reference' IS NOT NULL AND NEW.state->>'reference' IS DISTINCT FROM OLD.state->>'reference')
  OR (OLD.state->>'status'='REFUNDED' AND NEW.state->>'status'<>'REFUNDED')
  THEN RAISE EXCEPTION 'GATEWAY_REFUND_IMMUTABLE' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT state INTO captured FROM public."GatewayPayment" WHERE id=NEW."paymentId" FOR UPDATE;
 IF captured IS NULL OR captured->>'captured' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'GATEWAY_CAPTURE_REQUIRED' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum((state->>'amountMinor')::bigint),0) INTO reserved FROM public."GatewayRefund" WHERE "paymentId"=NEW."paymentId" AND id<>NEW.id AND state->>'status'<>'CANCELLED';
 IF NEW.state->>'status'<>'CANCELLED' AND reserved+(NEW.state->>'amountMinor')::bigint>(captured->>'amountMinor')::bigint THEN RAISE EXCEPTION 'GATEWAY_REFUND_BALANCE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$refund$;
CREATE TRIGGER gateway_refund_reserve BEFORE INSERT OR UPDATE ON public."GatewayRefund" FOR EACH ROW EXECUTE FUNCTION public.gateway_refund_reserve();
REVOKE ALL ON FUNCTION public.gateway_payment_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gateway_refund_reserve() FROM PUBLIC;
-- No role/ACL changes here. Review exact role/table/column grants separately before local activation.


-- PREPARED ONLY. No baseline ACLs/roles/cloud databases may be changed by this file.
-- Apply only after separate owner approval and exact local identity/OID/schema guards.

DO $identity$
BEGIN
 IF current_database()<>'flywithsafety_local_integration' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432
 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN
 RAISE EXCEPTION 'PHASE3_LOCAL_IDENTITY_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
 RAISE EXCEPTION 'PHASE3_RESTRICTED_ROLE_MISMATCH'; END IF;
END;
$identity$;
GRANT SELECT, INSERT ON public."GatewayPayment",public."GatewayRefund",public."GatewayPaymentEvent" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(status,"valId","bankId","dueAt",state) ON public."GatewayPayment" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(state) ON public."GatewayRefund" TO flywithsafe_phase2_booking_test;
GRANT EXECUTE ON FUNCTION public.gateway_payment_immutable(),public.gateway_refund_reserve() TO flywithsafe_phase2_booking_test;


INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(gen_random_uuid()::text,'da1e65891c57a827f2af5498b45d923d025d1f1d6fd80c9d9ab63fb986a802c5',clock_timestamp(),'20261103000100_gateway_sandbox_ledgers',clock_timestamp(),1);
DO $post$
DECLARE r record; amount bigint; counts jsonb:='{}'; signature text;
BEGIN
 FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund','_prisma_migrations') ORDER BY c.relname LOOP EXECUTE format('SELECT count(*) FROM public.%I',r.relname) INTO amount; counts:=counts||jsonb_build_object(r.relname,amount); END LOOP;
 SELECT (SELECT md5(coalesce(string_agg(row(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),c.relowner,c.relacl)::text,E'\n' ORDER BY c.relname,a.attnum),'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund')) INTO signature;
 IF counts<>current_setting('phase3.baseline_counts')::jsonb OR signature<>current_setting('phase3.baseline_metadata') THEN RAISE EXCEPTION 'PHASE3_EXISTING_RECORD_OR_SCHEMA_ACCESS_DRIFT'; END IF;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund') AND a.grantee=0) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_PUBLIC_TABLE_ACCESS'; END IF;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund') AND a.grantee<>c.relowner AND (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test') OR a.is_grantable OR a.privilege_type NOT IN ('SELECT','INSERT'))) THEN RAISE EXCEPTION 'PHASE3_UNEXPECTED_NEW_TABLE_GRANTEE'; END IF;
 FOREACH signature IN ARRAY ARRAY['GatewayPayment','GatewayPaymentEvent','GatewayRefund'] LOOP
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
 FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund','_prisma_migrations') ORDER BY c.relname LOOP EXECUTE format('SELECT count(*) FROM public.%I',r.relname) INTO amount; counts:=counts||jsonb_build_object(r.relname,amount); END LOOP;
 SELECT (SELECT md5(coalesce(string_agg(row(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),c.relowner,c.relacl)::text,E'\n' ORDER BY c.relname,a.attnum),'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund')) INTO signature;
 IF counts<>current_setting('phase3.baseline_counts')::jsonb OR signature<>current_setting('phase3.baseline_metadata') THEN RAISE EXCEPTION 'PHASE3_FINAL_BASELINE_PRESERVATION_MISMATCH'; END IF;
END;
$final$;
SELECT 'PHASE3_SCHEMA_FINAL_READONLY_PRESERVATION_PASS';
ROLLBACK;
