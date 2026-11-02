\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
DO $guard$
BEGIN
 IF current_database() <> 'flywithsafe_phase2_booking_integration'
    OR current_user <> 'flywithsafe_phase2_booking_test'
    OR session_user <> 'flywithsafe_phase2_booking_test'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 5432
    OR current_setting('transaction_read_only') <> 'on' THEN
   RAISE EXCEPTION 'PHASE2_SAME_INPUT_PSQL_IDENTITY_STOP';
 END IF;
END $guard$;
SELECT 'PHASE2_SAME_INPUT_PSQL_READONLY_PASS' AS result;
ROLLBACK;
