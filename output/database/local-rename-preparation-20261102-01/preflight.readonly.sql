\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
DO $target$ BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'postgres'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'EXACT_CLEANUP_WRONG_LOCAL_TARGET_OR_ADMIN'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 OR EXISTS(SELECT FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) AS expected(migration_name,checksum)
 WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.migration_name AND m.checksum=expected.checksum)) THEN RAISE EXCEPTION 'EXACT_CLEANUP_MIGRATION_MISMATCH'; END IF;
END $target$;
DO $guard$
DECLARE r oid; c record; column_row record; expected_select boolean; expected_insert boolean; expected_update boolean;
BEGIN
 SELECT oid INTO STRICT r FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=12;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=r OR roleid=r)
 OR has_database_privilege(r,current_database(),'CREATE') OR has_database_privilege(r,current_database(),'TEMP')
 OR has_schema_privilege(r,'public','CREATE') THEN RAISE EXCEPTION 'ROLE_RESTRICTIONS_FAILED'; END IF;
 FOR c IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') LOOP
   IF has_table_privilege(r,c.oid,'DELETE') OR has_table_privilege(r,c.oid,'TRUNCATE') OR has_table_privilege(r,c.oid,'TRIGGER') OR has_table_privilege(r,c.oid,'REFERENCES') THEN RAISE EXCEPTION 'DANGEROUS_TABLE_PRIVILEGE'; END IF;
   FOR column_row IN SELECT attname,attnum FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped LOOP
     expected_select := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry')
       OR (c.relname='_prisma_migrations' AND column_row.attname IN ('migration_name','checksum','finished_at','rolled_back_at'));
     expected_insert := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox');
     expected_update := (c.relname='User' AND column_row.attname='name')
       OR (c.relname='Session' AND column_row.attname IN ('revokedAt','lastUsedAt'))
       OR (c.relname='Booking' AND column_row.attname IN ('status','bookingDetails','totalPrice','updatedAt'));
     IF has_column_privilege(r,c.oid,column_row.attnum,'SELECT')<>expected_select
       OR has_column_privilege(r,c.oid,column_row.attnum,'INSERT')<>expected_insert
       OR has_column_privilege(r,c.oid,column_row.attnum,'UPDATE')<>expected_update
       OR has_column_privilege(r,c.oid,column_row.attnum,'REFERENCES') THEN RAISE EXCEPTION 'EXACT_COLUMN_MATRIX_FAILED'; END IF;
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class WHERE relowner=r)
 OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r)
 OR EXISTS(SELECT FROM pg_class acl_relation CROSS JOIN LATERAL aclexplode(acl_relation.relacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_database target_database CROSS JOIN LATERAL aclexplode(target_database.datacl) acl_entry WHERE target_database.datname=current_database() AND acl_entry.grantee=0)
 THEN RAISE EXCEPTION 'OWNERSHIP_GRANT_OPTION_OR_PUBLIC_ACCESS_FAILED'; END IF;
 IF NOT has_column_privilege(r,'public."Booking"','bookingDetails','UPDATE')
 OR has_column_privilege(r,'public."Booking"','userId','UPDATE')
 OR has_column_privilege(r,'public."User"','role','UPDATE')
 OR has_table_privilege(r,'public."ContactMessage"','SELECT') THEN RAISE EXCEPTION 'ACCESS_MATRIX_FAILED'; END IF;
END $guard$;
DO $rename_preflight$ BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'READ_ONLY_REQUIRED'; END IF;
 IF EXISTS(SELECT FROM pg_database WHERE datname='flywithsafety_local_integration') THEN RAISE EXCEPTION 'RENAME_DESTINATION_ALREADY_EXISTS'; END IF;
 IF NOT EXISTS(SELECT FROM pg_database WHERE datname=current_database() AND pg_get_userbyid(datdba)='postgres' AND NOT datistemplate AND datallowconn) THEN RAISE EXCEPTION 'RENAME_SOURCE_METADATA_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'ACTIVE_SOURCE_CONNECTIONS_STOP_NO_TERMINATION'; END IF;
END $rename_preflight$;
SELECT current_database() AS database,current_user AS role,inet_server_addr() AS host,inet_server_port() AS port,current_setting('server_version') AS version;
SELECT oid AS source_database_oid,datname,pg_get_userbyid(datdba) AS owner,datallowconn,datconnlimit,datacl::text AS database_acl FROM pg_database WHERE datname=current_database();
SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name;
SELECT count(*) AS other_target_connections FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid();
SELECT NOT EXISTS(SELECT FROM pg_database WHERE datname='flywithsafety_local_integration') AS destination_name_available;
SELECT (SELECT count(*) FROM public."User") AS users,(SELECT count(*) FROM public."Session") AS sessions,(SELECT count(*) FROM public."Booking") AS bookings;
ROLLBACK;
\echo LOCAL_RENAME_PREFLIGHT_PASS_NO_RENAME
