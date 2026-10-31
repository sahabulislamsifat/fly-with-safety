-- REVIEW ONLY. Separate owner authorization required. Never applied automatically.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres' OR session_user<>'postgres'
 OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port()<>5432
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'postgres'
 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='flywithsafe_phase1_service_test')
 OR EXISTS(SELECT 1 FROM public."User")
 OR EXISTS(SELECT 1 FROM public."ProtectedCredential")
 OR EXISTS(SELECT 1 FROM public."ProtectedAuthJob")
 OR EXISTS(SELECT 1 FROM public."AuthIssuanceRequest")
 OR (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>7
 THEN RAISE EXCEPTION 'PHASE1_SERVICE_ROLE_PREFLIGHT'; END IF;
 -- A new role also receives PUBLIC privileges. Fail before CREATE ROLE if another
 -- connectable database would admit it through PUBLIC; never change other DB ACLs.
 IF EXISTS(SELECT 1 FROM pg_database db
 CROSS JOIN LATERAL aclexplode(COALESCE(db.datacl,acldefault('d',db.datdba))) acl
 WHERE db.datname<>'flywithsafe_phase1_schema_integration' AND db.datallowconn
 AND acl.grantee=0 AND acl.privilege_type='CONNECT') THEN
  RAISE EXCEPTION 'UNRELATED_PUBLIC_CONNECT_REQUIRES_REVIEW';
 END IF;
END $guard$;
CREATE ROLE flywithsafe_phase1_service_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20;
ALTER ROLE flywithsafe_phase1_service_test SET statement_timeout='5s';
GRANT CONNECT ON DATABASE flywithsafe_phase1_schema_integration TO flywithsafe_phase1_service_test;
GRANT USAGE ON SCHEMA public TO flywithsafe_phase1_service_test;
-- Exact actual-adapter read/write surface; no DELETE/TRUNCATE/schema/ownership/grant options.
GRANT SELECT,INSERT,UPDATE ON public."User",public."AuthSecurityState",public."ProtectedCredential",public."ProtectedAuthJob",public."Session",public."AuthIssuanceRequest" TO flywithsafe_phase1_service_test;
GRANT SELECT ON public."NotificationQuarantine" TO flywithsafe_phase1_service_test;
GRANT EXECUTE ON FUNCTION public.protected_envelope_shape(jsonb) TO flywithsafe_phase1_service_test;
COMMIT;
-- Private psql console only; the role remains NOLOGIN if this stage is interrupted.
\password flywithsafe_phase1_service_test
BEGIN;
DO $login$ BEGIN
 IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_authid WHERE rolname='flywithsafe_phase1_service_test'
 AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolpassword LIKE 'SCRAM-SHA-256$%')
 THEN RAISE EXCEPTION 'PHASE1_SERVICE_PRIVATE_PASSWORD_GUARD'; END IF;
END $login$;
ALTER ROLE flywithsafe_phase1_service_test LOGIN;
COMMIT;
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
DO $postcheck$
DECLARE target_role oid:=(SELECT oid FROM pg_roles WHERE rolname='flywithsafe_phase1_service_test'); rel record;
BEGIN
 IF target_role IS NULL OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=target_role OR roleid=target_role)
 OR NOT has_database_privilege(target_role,current_database(),'CONNECT')
 OR has_database_privilege(target_role,current_database(),'CREATE')
 OR has_database_privilege(target_role,current_database(),'TEMP')
 OR NOT has_schema_privilege(target_role,'public','USAGE')
 OR has_schema_privilege(target_role,'public','CREATE')
 THEN RAISE EXCEPTION 'SERVICE_ROLE_DATABASE_PRIVILEGES'; END IF;
 FOR rel IN SELECT c.oid,c.relname,c.relowner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p') LOOP
  IF rel.relowner=target_role OR has_table_privilege(target_role,rel.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'SERVICE_ROLE_EXCESS_RIGHTS'; END IF;
  IF rel.relname=ANY(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest']) THEN
   IF NOT has_table_privilege(target_role,rel.oid,'SELECT') OR NOT has_table_privilege(target_role,rel.oid,'INSERT')
   OR NOT has_table_privilege(target_role,rel.oid,'UPDATE') THEN RAISE EXCEPTION 'SERVICE_ROLE_MISSING_RIGHTS'; END IF;
  ELSIF rel.relname='NotificationQuarantine' THEN
   IF NOT has_table_privilege(target_role,rel.oid,'SELECT') OR has_table_privilege(target_role,rel.oid,'INSERT,UPDATE') THEN RAISE EXCEPTION 'SERVICE_ROLE_QUARANTINE_RIGHTS'; END IF;
  ELSIF has_table_privilege(target_role,rel.oid,'SELECT,INSERT,UPDATE') THEN RAISE EXCEPTION 'SERVICE_ROLE_UNRELATED_ACCESS'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE acl.grantee=target_role AND acl.is_grantable)
 OR EXISTS(SELECT 1 FROM pg_attribute attr CROSS JOIN LATERAL aclexplode(attr.attacl) acl WHERE acl.grantee=target_role AND acl.is_grantable)
 THEN RAISE EXCEPTION 'SERVICE_ROLE_GRANT_OPTION'; END IF;
END $postcheck$;
SELECT 'PHASE1_SERVICE_ROLE_ADMIN_POSTCHECK_PASS' AS result;
ROLLBACK;
-- Actual restricted-role authentication still must pass before fixture execution.
