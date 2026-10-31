\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432 THEN RAISE EXCEPTION 'WRONG_ADMIN_TARGET'; END IF;
 IF EXISTS(SELECT FROM pg_database WHERE datname='flywithsafe_phase2_booking_integration')
 OR EXISTS(SELECT FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test') THEN RAISE EXCEPTION 'RESOURCE_ALREADY_EXISTS_STOP'; END IF;
END $guard$;
ROLLBACK;
CREATE DATABASE flywithsafe_phase2_booking_integration OWNER postgres;
REVOKE ALL ON DATABASE flywithsafe_phase2_booking_integration FROM PUBLIC;
\echo PHASE2_NEW_TARGET_CREATED_ACCESS_RESTRICTED
