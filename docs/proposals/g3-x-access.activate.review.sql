\set ON_ERROR_STOP on
\pset pager off
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';

DO $guard$
DECLARE r oid; reader oid; t record; a record; expected boolean; n text; rc bigint;
BEGIN
 IF NOT COALESCE(current_database()='flywithsafe_g3_auth02_disposable'
 AND current_user='postgres' AND session_user='postgres'
 AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND current_setting('server_version_num')='180006',false)
 OR NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND pg_get_userbyid(datdba)='postgres' AND pg_encoding_to_char(encoding)='UTF8')
 THEN RAISE EXCEPTION 'G3_ACCESS_IDENTITY_FAILED'; END IF;
 SELECT oid INTO r FROM pg_roles WHERE rolname='flywithsafe_g3_auth02_test'
 AND rolcanlogin=false AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=20;

 IF NOT EXISTS(SELECT 1 FROM pg_authid WHERE oid=r AND rolpassword LIKE 'SCRAM-SHA-256$%')
 THEN RAISE EXCEPTION 'G3_ACCESS_EXISTING_PRIVATE_PASSWORD_REQUIRED'; END IF;
 SELECT oid INTO reader FROM pg_roles WHERE rolname='flywithsafe_g3_status_reader'
 AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=20;
 IF r IS NULL OR reader IS NULL THEN RAISE EXCEPTION 'G3_ACCESS_ROLE_FLAGS_FAILED'; END IF;
 FOREACH n IN ARRAY ARRAY['flywithsafe_g3_auth02_test','flywithsafe_g3_status_reader'] LOOP
  IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=n) OR roleid=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR NOT has_database_privilege(n,current_database(),'CONNECT')
  OR has_database_privilege(n,current_database(),'CREATE') OR has_database_privilege(n,current_database(),'TEMP')
  OR NOT has_schema_privilege(n,'public','USAGE') OR has_schema_privilege(n,'public','CREATE')
  OR (SELECT setconfig FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM pg_roles WHERE rolname=n) AND setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()))
    IS DISTINCT FROM ARRAY['statement_timeout=5s']::text[]
  OR (SELECT count(*) FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM pg_roles WHERE rolname=n))<>1
  THEN RAISE EXCEPTION 'G3_ACCESS_EXISTING_BOUNDARIES_FAILED'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p'))<>20
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND (c.relrowsecurity OR c.relforcerowsecurity))
 OR EXISTS(SELECT 1 FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND NOT tr.tgisinternal)
 OR EXISTS(SELECT 1 FROM pg_rules WHERE schemaname='public')
 OR EXISTS(SELECT 1 FROM pg_event_trigger)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname NOT IN ('pg_catalog','information_schema') AND p.prosecdef)
 OR EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace s ON s.oid=e.extnamespace WHERE s.nspname='public')
 OR EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) x WHERE d.datname=current_database() AND x.grantee=0)
 OR EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) x WHERE s.nspname='public' AND x.grantee=0)
 THEN RAISE EXCEPTION 'G3_ACCESS_SCHEMA_OR_ISOLATION_FAILED'; END IF;
 
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(
 SELECT 1 FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),
('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),
('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),
('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),
('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),
('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),
('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) AS e(name,checksum)
 LEFT JOIN public._prisma_migrations m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum<>e.checksum OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 THEN RAISE EXCEPTION 'G3_ACCESS_HISTORY_FAILED'; END IF;

 FOR t IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p') LOOP
  expected=false AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session');
  IF has_table_privilege(r,t.oid,'SELECT')<>expected OR has_table_privilege(r,t.oid,'INSERT')<>expected
   OR has_table_privilege(r,t.oid,'UPDATE')<>expected OR has_table_privilege(r,t.oid,'DELETE')<>expected
   OR has_table_privilege(r,t.oid,'TRUNCATE') OR has_table_privilege(r,t.oid,'REFERENCES')
   OR has_table_privilege(r,t.oid,'TRIGGER') OR has_table_privilege(r,t.oid,'MAINTAIN')
   OR has_any_column_privilege(reader,t.oid,'SELECT') OR has_any_column_privilege(reader,t.oid,'INSERT')
   OR has_any_column_privilege(reader,t.oid,'UPDATE') OR has_table_privilege(reader,t.oid,'DELETE')
   THEN RAISE EXCEPTION 'G3_ACCESS_TABLE_PRIVILEGE_FAILED'; END IF;
  FOR a IN SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
   expected=false AND (t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session')
    OR (t.relname='NotificationOutbox' AND a.attname='id')
    OR (t.relname='_prisma_migrations' AND a.attname IN ('migration_name','checksum','finished_at','rolled_back_at')));
   IF has_column_privilege(r,t.oid,a.attname,'SELECT')<>expected
    OR has_column_privilege(r,t.oid,a.attname,'INSERT')<>(false AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session'))
    OR has_column_privilege(r,t.oid,a.attname,'UPDATE')<>(false AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session'))
    OR has_column_privilege(r,t.oid,a.attname,'REFERENCES')
    THEN RAISE EXCEPTION 'G3_ACCESS_COLUMN_PRIVILEGE_FAILED'; END IF;
  END LOOP;
 END LOOP;

 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(c.relacl) x WHERE s.nspname='public' AND x.grantee IN(r,reader) AND x.is_grantable)
 OR EXISTS(SELECT 1 FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) x WHERE x.grantee IN(r,reader) AND x.is_grantable)
 OR NOT has_language_privilege(r,'plpgsql','USAGE')
 THEN RAISE EXCEPTION 'G3_ACCESS_GRANT_OPTION_OR_LANGUAGE_FAILED'; END IF;

 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.relkind='S' AND
   (has_sequence_privilege(r,c.oid,'USAGE') OR has_sequence_privilege(r,c.oid,'SELECT') OR has_sequence_privilege(r,c.oid,'UPDATE')))
 OR EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) x WHERE x.grantee IN(0,r,reader))
 OR EXISTS(SELECT 1 FROM pg_parameter_acl p CROSS JOIN LATERAL aclexplode(p.paracl) x WHERE x.grantee IN(0,r,reader))
 THEN RAISE EXCEPTION 'G3_ACCESS_EXTRA_PRIVILEGES_FAILED'; END IF;
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' LOOP
 EXECUTE format('SELECT count(*) FROM public.%I',t.relname) INTO rc;
 IF rc<>0 THEN RAISE EXCEPTION 'G3_ACCESS_NONEMPTY_TARGET'; END IF;
 END LOOP;
END $guard$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User", public."EmailVerificationToken",
 public."PasswordResetToken", public."Session" TO flywithsafe_g3_auth02_test;
GRANT SELECT (id) ON TABLE public."NotificationOutbox" TO flywithsafe_g3_auth02_test;
GRANT SELECT (migration_name,checksum,finished_at,rolled_back_at)
 ON TABLE public._prisma_migrations TO flywithsafe_g3_auth02_test;
ALTER ROLE flywithsafe_g3_auth02_test LOGIN;

DO $guard$
DECLARE r oid; reader oid; t record; a record; expected boolean; n text; rc bigint;
BEGIN
 IF NOT COALESCE(current_database()='flywithsafe_g3_auth02_disposable'
 AND current_user='postgres' AND session_user='postgres'
 AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND current_setting('server_version_num')='180006',false)
 OR NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND pg_get_userbyid(datdba)='postgres' AND pg_encoding_to_char(encoding)='UTF8')
 THEN RAISE EXCEPTION 'G3_ACCESS_IDENTITY_FAILED'; END IF;
 SELECT oid INTO r FROM pg_roles WHERE rolname='flywithsafe_g3_auth02_test'
 AND rolcanlogin=true AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=20;
 SELECT oid INTO reader FROM pg_roles WHERE rolname='flywithsafe_g3_status_reader'
 AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=20;
 IF r IS NULL OR reader IS NULL THEN RAISE EXCEPTION 'G3_ACCESS_ROLE_FLAGS_FAILED'; END IF;
 FOREACH n IN ARRAY ARRAY['flywithsafe_g3_auth02_test','flywithsafe_g3_status_reader'] LOOP
  IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=n) OR roleid=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=n))
  OR NOT has_database_privilege(n,current_database(),'CONNECT')
  OR has_database_privilege(n,current_database(),'CREATE') OR has_database_privilege(n,current_database(),'TEMP')
  OR NOT has_schema_privilege(n,'public','USAGE') OR has_schema_privilege(n,'public','CREATE')
  OR (SELECT setconfig FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM pg_roles WHERE rolname=n) AND setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()))
    IS DISTINCT FROM ARRAY['statement_timeout=5s']::text[]
  OR (SELECT count(*) FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM pg_roles WHERE rolname=n))<>1
  THEN RAISE EXCEPTION 'G3_ACCESS_EXISTING_BOUNDARIES_FAILED'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p'))<>20
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND (c.relrowsecurity OR c.relforcerowsecurity))
 OR EXISTS(SELECT 1 FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND NOT tr.tgisinternal)
 OR EXISTS(SELECT 1 FROM pg_rules WHERE schemaname='public')
 OR EXISTS(SELECT 1 FROM pg_event_trigger)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname NOT IN ('pg_catalog','information_schema') AND p.prosecdef)
 OR EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace s ON s.oid=e.extnamespace WHERE s.nspname='public')
 OR EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) x WHERE d.datname=current_database() AND x.grantee=0)
 OR EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) x WHERE s.nspname='public' AND x.grantee=0)
 THEN RAISE EXCEPTION 'G3_ACCESS_SCHEMA_OR_ISOLATION_FAILED'; END IF;
 
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(
 SELECT 1 FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),
('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),
('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),
('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),
('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),
('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),
('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) AS e(name,checksum)
 LEFT JOIN public._prisma_migrations m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum<>e.checksum OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 THEN RAISE EXCEPTION 'G3_ACCESS_HISTORY_FAILED'; END IF;

 FOR t IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p') LOOP
  expected=true AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session');
  IF has_table_privilege(r,t.oid,'SELECT')<>expected OR has_table_privilege(r,t.oid,'INSERT')<>expected
   OR has_table_privilege(r,t.oid,'UPDATE')<>expected OR has_table_privilege(r,t.oid,'DELETE')<>expected
   OR has_table_privilege(r,t.oid,'TRUNCATE') OR has_table_privilege(r,t.oid,'REFERENCES')
   OR has_table_privilege(r,t.oid,'TRIGGER') OR has_table_privilege(r,t.oid,'MAINTAIN')
   OR has_any_column_privilege(reader,t.oid,'SELECT') OR has_any_column_privilege(reader,t.oid,'INSERT')
   OR has_any_column_privilege(reader,t.oid,'UPDATE') OR has_table_privilege(reader,t.oid,'DELETE')
   THEN RAISE EXCEPTION 'G3_ACCESS_TABLE_PRIVILEGE_FAILED'; END IF;
  FOR a IN SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
   expected=true AND (t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session')
    OR (t.relname='NotificationOutbox' AND a.attname='id')
    OR (t.relname='_prisma_migrations' AND a.attname IN ('migration_name','checksum','finished_at','rolled_back_at')));
   IF has_column_privilege(r,t.oid,a.attname,'SELECT')<>expected
    OR has_column_privilege(r,t.oid,a.attname,'INSERT')<>(true AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session'))
    OR has_column_privilege(r,t.oid,a.attname,'UPDATE')<>(true AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session'))
    OR has_column_privilege(r,t.oid,a.attname,'REFERENCES')
    THEN RAISE EXCEPTION 'G3_ACCESS_COLUMN_PRIVILEGE_FAILED'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.relkind='S' AND
   (has_sequence_privilege(r,c.oid,'USAGE') OR has_sequence_privilege(r,c.oid,'SELECT') OR has_sequence_privilege(r,c.oid,'UPDATE')))
 OR EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) x WHERE x.grantee IN(0,r,reader))
 OR EXISTS(SELECT 1 FROM pg_parameter_acl p CROSS JOIN LATERAL aclexplode(p.paracl) x WHERE x.grantee IN(0,r,reader))
 THEN RAISE EXCEPTION 'G3_ACCESS_EXTRA_PRIVILEGES_FAILED'; END IF;
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' LOOP
 EXECUTE format('SELECT count(*) FROM public.%I',t.relname) INTO rc;
 IF rc<>0 THEN RAISE EXCEPTION 'G3_ACCESS_NONEMPTY_TARGET'; END IF;
 END LOOP;
END $guard$;
COMMIT;
\echo G3_X_ACCESS_ACTIVATION_COMMITTED
