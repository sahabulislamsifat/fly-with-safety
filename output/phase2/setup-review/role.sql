\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
DO $guard$
BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'postgres'
 OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 THEN RAISE EXCEPTION 'WRONG_TARGET'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test') THEN RAISE EXCEPTION 'ROLE_EXISTS_STOP'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>7
 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 THEN RAISE EXCEPTION 'BASELINE_HISTORY_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM public."User") OR EXISTS(SELECT FROM public."Booking")
 OR EXISTS(SELECT FROM public."Session") OR EXISTS(SELECT FROM public."IdempotencyRecord")
 OR EXISTS(SELECT FROM public."NotificationOutbox") THEN RAISE EXCEPTION 'NONEMPTY_TARGET'; END IF;
END $guard$;
CREATE ROLE flywithsafe_phase2_booking_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 12;
ALTER ROLE flywithsafe_phase2_booking_test IN DATABASE flywithsafe_phase2_booking_integration SET statement_timeout='5s';
ALTER ROLE flywithsafe_phase2_booking_test IN DATABASE flywithsafe_phase2_booking_integration SET lock_timeout='2s';
ALTER ROLE flywithsafe_phase2_booking_test IN DATABASE flywithsafe_phase2_booking_integration SET idle_in_transaction_session_timeout='5s';
GRANT CONNECT ON DATABASE flywithsafe_phase2_booking_integration TO flywithsafe_phase2_booking_test;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO flywithsafe_phase2_booking_test;
GRANT SELECT,INSERT ON public."User",public."Session",public."Booking",public."BookingPassenger",public."BookingStatusHistory",public."IdempotencyRecord",public."NotificationOutbox" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(name) ON public."User" TO flywithsafe_phase2_booking_test;
GRANT UPDATE("revokedAt","lastUsedAt") ON public."Session" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(status,"bookingDetails","totalPrice","updatedAt") ON public."Booking" TO flywithsafe_phase2_booking_test;
GRANT SELECT ON public."FlightInquiry",public."HotelInquiry",public."PackageInquiry",public."VisaInquiry" TO flywithsafe_phase2_booking_test;
GRANT SELECT(migration_name,checksum,finished_at,rolled_back_at) ON public._prisma_migrations TO flywithsafe_phase2_booking_test;
\echo Set a NEW development-only Phase2 role password privately. Never paste it into chat.
\password flywithsafe_phase2_booking_test
ALTER ROLE flywithsafe_phase2_booking_test LOGIN;
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
COMMIT;
\echo PHASE2_RESTRICTED_ROLE_SETUP_PASS
