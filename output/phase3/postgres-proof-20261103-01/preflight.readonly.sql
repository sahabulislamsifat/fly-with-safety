BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='2000ms';
DO $guard$
DECLARE t text;
BEGIN
 IF current_setting('transaction_read_only')<>'on' OR current_database()<>'flywithsafety_local_integration' OR current_user<>'flywithsafe_phase2_booking_test' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN RAISE EXCEPTION 'PHASE3_RESTRICTED_IDENTITY_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_stat_activity WHERE datid=34701 AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'PHASE3_OTHER_LOCAL_CONNECTION_STOP_NO_TERMINATION'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR NOT rolcanlogin)) OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR has_schema_privilege(current_user,'public','CREATE') THEN RAISE EXCEPTION 'PHASE3_UNSAFE_ROLE'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>8 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) OR EXISTS(SELECT FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),
('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),
('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),
('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),
('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),
('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),
('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b'),
('20261103000100_gateway_sandbox_ledgers','da1e65891c57a827f2af5498b45d923d025d1f1d6fd80c9d9ab63fb986a802c5')) expected(name,checksum) WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.name AND m.checksum=expected.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)) THEN RAISE EXCEPTION 'PHASE3_EIGHT_PINNED_MIGRATIONS_MISMATCH'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund') AND relkind='r')<>3 OR (SELECT count(*) FROM pg_index WHERE indrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND indisvalid AND indisready)<>14 THEN RAISE EXCEPTION 'PHASE3_TABLE_INDEX_MISMATCH'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayRefund"'::regclass) AND NOT tgisinternal AND tgenabled='O')<>2 OR (SELECT count(*) FROM pg_constraint WHERE conrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND contype='f' AND convalidated AND confdeltype='r')<>4 THEN RAISE EXCEPTION 'PHASE3_TRIGGER_OR_FOREIGN_KEY_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='gateway_payment_immutable' AND p.prosrc='
BEGIN
 IF ROW(NEW.id,NEW."bookingId",NEW."userId",NEW."requestId",NEW."tranId") IS DISTINCT FROM ROW(OLD.id,OLD."bookingId",OLD."userId",OLD."requestId",OLD."tranId")
 OR (NEW.state - ARRAY[''status'',''session'',''valId'',''bankId'',''channel'',''captured'',''checks'',''due'',''lease'',''updated'']) IS DISTINCT FROM (OLD.state - ARRAY[''status'',''session'',''valId'',''bankId'',''channel'',''captured'',''checks'',''due'',''lease'',''updated''])
 OR (OLD."valId" IS NOT NULL AND NEW."valId" IS DISTINCT FROM OLD."valId")
 OR (OLD."bankId" IS NOT NULL AND NEW."bankId" IS DISTINCT FROM OLD."bankId")
 OR ((OLD.state->>''captured'')::boolean AND NOT (NEW.state->>''captured'')::boolean)
 OR (OLD.status IN (''RISK_REVIEW'',''EXCEPTION_REVIEW'') AND NEW.status=''VERIFIED'')
 THEN RAISE EXCEPTION ''GATEWAY_IMMUTABLE_IDENTITY_OR_CAPTURE'' USING ERRCODE=''23514''; END IF;
 RETURN NEW;
END;
' AND NOT p.prosecdef AND p.prorettype='trigger'::regtype AND has_function_privilege(current_user,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'PHASE3_FUNCTION_BODY_OR_SECURITY_MISMATCH'; END IF;
IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='gateway_refund_reserve' AND p.prosrc='
DECLARE captured jsonb; reserved bigint;
BEGIN
 IF TG_OP=''UPDATE'' THEN
  IF ROW(NEW.id,NEW."paymentId",NEW."requestId",NEW."actorId") IS DISTINCT FROM ROW(OLD.id,OLD."paymentId",OLD."requestId",OLD."actorId")
  OR (NEW.state - ARRAY[''status'',''reference'',''updated'']) IS DISTINCT FROM (OLD.state - ARRAY[''status'',''reference'',''updated''])
  OR (OLD.state->>''reference'' IS NOT NULL AND NEW.state->>''reference'' IS DISTINCT FROM OLD.state->>''reference'')
  OR (OLD.state->>''status''=''REFUNDED'' AND NEW.state->>''status''<>''REFUNDED'')
  THEN RAISE EXCEPTION ''GATEWAY_REFUND_IMMUTABLE'' USING ERRCODE=''23514''; END IF;
 END IF;
 SELECT state INTO captured FROM public."GatewayPayment" WHERE id=NEW."paymentId" FOR UPDATE;
 IF captured IS NULL OR captured->>''captured'' IS DISTINCT FROM ''true'' THEN RAISE EXCEPTION ''GATEWAY_CAPTURE_REQUIRED'' USING ERRCODE=''23514''; END IF;
 SELECT coalesce(sum((state->>''amountMinor'')::bigint),0) INTO reserved FROM public."GatewayRefund" WHERE "paymentId"=NEW."paymentId" AND id<>NEW.id AND state->>''status''<>''CANCELLED'';
 IF NEW.state->>''status''<>''CANCELLED'' AND reserved+(NEW.state->>''amountMinor'')::bigint>(captured->>''amountMinor'')::bigint THEN RAISE EXCEPTION ''GATEWAY_REFUND_BALANCE'' USING ERRCODE=''23514''; END IF;
 RETURN NEW;
END;
' AND NOT p.prosecdef AND p.prorettype='trigger'::regtype AND has_function_privilege(current_user,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'PHASE3_FUNCTION_BODY_OR_SECURITY_MISMATCH'; END IF;
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
