\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
DO $$
DECLARE names text[]:=ARRAY['AuthSecurityState','ProtectedCredential','ProtectedAuthJob','PassengerSecret',
  'AuthIssuanceRequest','NotificationQuarantine','CompatibleNotificationLease','NotificationSendIntent'];
  relation record; populated boolean;
BEGIN
  IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres' OR session_user<>'postgres'
    OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port()<>5432 OR current_setting('transaction_read_only')<>'on'
    OR current_setting('server_version')<>'18.6'
    OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'postgres'
    OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'PHASE1_POSTCHECK_TARGET'; END IF;
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>28
    OR (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename=ANY(names) AND tableowner='postgres')<>8
    OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY(names)))<>12
    OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND condeferrable AND condeferred AND conrelid IN ('public."ProtectedCredential"'::regclass,'public."ProtectedAuthJob"'::regclass))<>2
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE NOT convalidated AND conrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace))
    OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname=ANY(ARRAY[
      'protected_identity_generation','protected_monotonic_generation','protected_request_immutable','protected_request_complete',
      'notification_send_intent_immutable','protected_enrollment_monotonic','protected_credential_immutable','protected_job_fencing','passenger_secret_revision']))<>9
    OR (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname=ANY(ARRAY[
      'protected_one_live_purpose','protected_credential_subject_lookup','protected_job_dispatch','passenger_secret_booking',
      'issuance_receipt_subject','issuance_receipt_job','issuance_receipt_session']))<>7
    OR (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>7
    THEN RAISE EXCEPTION 'PHASE1_SCHEMA_CONTRACT_MISMATCH'; END IF;
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',relation.tablename) INTO populated;
    IF populated THEN RAISE EXCEPTION 'PHASE1_POSTCHECK_NOT_CLEAN'; END IF;
  END LOOP;
END $$;
SELECT c.relname,k.conname,pg_get_constraintdef(k.oid),k.condeferrable,k.condeferred,k.convalidated
  FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.relnamespace='public'::regnamespace ORDER BY c.relname,k.conname;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace ORDER BY c.relname,t.tgname;
SELECT p.proname,pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[
  'protected_identity_generation','protected_monotonic_generation','protected_request_immutable','protected_request_complete',
  'notification_send_intent_immutable','protected_enrollment_monotonic','protected_credential_immutable','protected_job_fencing',
  'passenger_secret_revision','protected_envelope_shape']) ORDER BY p.proname;
SELECT table_name,column_name,data_type,is_nullable,datetime_precision FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN ('AuthSecurityState','ProtectedCredential','ProtectedAuthJob','PassengerSecret',
  'AuthIssuanceRequest','NotificationQuarantine','CompatibleNotificationLease','NotificationSendIntent') ORDER BY table_name,ordinal_position;
SELECT 'PHASE1_SCHEMA_CLEAN_REQUIRES_DEFINITION_REVIEW' AS result;
ROLLBACK;
