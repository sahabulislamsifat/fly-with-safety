\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='5s';
DO $identity$
BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'flywithsafe_phase2_booking_test'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'LOCAL_READONLY_IDENTITY_MISMATCH'; END IF;
END $identity$;
SELECT current_database(),current_user,current_setting('transaction_read_only') AS read_only;
WITH expected(id,role) AS (VALUES ('7a504831-759c-4c1c-8325-4a187f711d91','CUSTOMER'),
('e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','CUSTOMER'),
('698a9431-d269-4c63-ae57-23e14503d477','STAFF'),
('76374639-4185-4f99-a451-155c2250503d','ADMIN'))
SELECT u.id,u.role,u."createdAt",CASE WHEN e.id IS NOT NULL THEN 'HISTORICAL_LEDGER_MATCH' ELSE 'UNATTRIBUTED_DO_NOT_CLEAN' END AS ownership,
 (u.email=u.id||'@example.invalid') AS fixture_email_pattern,
 (u.role::text=e.role) AS ledger_role_matches,
 u."emailVerified",u.password IS NOT NULL AS password_present,
 (length(u.password)=60 AND left(u.password,7) IN ('$2a$12$','$2b$12$','$2y$12$')) AS bcrypt_cost12_format,
 (SELECT count(*) FROM public."Session" s WHERE s."userId"=u.id) AS sessions,
 (SELECT count(*) FROM public."Session" s WHERE s."userId"=u.id AND s."revokedAt" IS NULL AND s."expiresAt">CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS active_sessions,
 (SELECT count(*) FROM public."Booking" b WHERE b."userId"=u.id) AS bookings
FROM public."User" u LEFT JOIN expected e ON e.id=u.id ORDER BY ownership,u.id;
SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname=current_user;
SELECT has_column_privilege(current_user,'public."User"','password','SELECT') AS password_read_allowed,
 has_table_privilege(current_user,'public."Session"','INSERT') AS login_session_insert,
 has_column_privilege(current_user,'public."Session"','revokedAt','UPDATE') AS refresh_revoke,
 has_column_privilege(current_user,'public."Session"','lastUsedAt','UPDATE') AS refresh_last_used,
 has_table_privilege(current_user,'public."Account"','SELECT') AS account_read_available,
 has_table_privilege(current_user,'public."User"','DELETE') AS user_delete_must_be_false,
 has_schema_privilege(current_user,'public','CREATE') AS ddl_must_be_false;
SELECT b.id,b."userId",b.status,b."totalPrice",b.currency,
 (SELECT count(*) FROM public."BookingPassenger" p WHERE p."bookingId"=b.id) AS passenger_count,
 (SELECT count(*) FROM public."BookingStatusHistory" h WHERE h."bookingId"=b.id) AS history_count
FROM public."Booking" b;
ROLLBACK;
\echo PHASE2_LOCAL_OWNERSHIP_AUTH_METADATA_READONLY_PASS
