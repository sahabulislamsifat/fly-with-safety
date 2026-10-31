\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
DO $$
DECLARE relation record; populated boolean;
BEGIN
  IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres' OR session_user<>'postgres'
    OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port()<>5432
    OR current_setting('server_version')<>'18.6' OR current_setting('transaction_read_only')<>'on'
    OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'postgres'
    OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) THEN
    RAISE EXCEPTION 'PHASE1_SCHEMA_TARGET_GUARD_FAILED';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind='r')<>20
    OR (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS (
    SELECT 1 FROM (VALUES
      ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),
      ('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),
      ('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),
      ('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),
      ('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),
      ('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),
      ('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')
    ) expected(name,checksum) LEFT JOIN public._prisma_migrations m ON m.migration_name=expected.name
    WHERE m.id IS NULL OR m.checksum<>expected.checksum OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'PHASE1_BASELINE_MISMATCH'; END IF;
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',relation.tablename) INTO populated;
    IF populated THEN RAISE EXCEPTION 'PHASE1_BASELINE_NOT_EMPTY'; END IF;
  END LOOP;
END $$;
SELECT 'PHASE1_SCHEMA_PREFLIGHT_PASS' AS result;
ROLLBACK;
