-- PREPARED ONLY. No baseline ACLs/roles/cloud databases may be changed by this file.
-- Apply only after separate owner approval and exact local identity/OID/schema guards.
BEGIN;
DO $identity$
BEGIN
 IF current_database()<>'flywithsafety_local_integration' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432
 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701 THEN
 RAISE EXCEPTION 'PHASE3_LOCAL_IDENTITY_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
 RAISE EXCEPTION 'PHASE3_RESTRICTED_ROLE_MISMATCH'; END IF;
END;
$identity$;
GRANT SELECT, INSERT ON public."GatewayPayment",public."GatewayRefund",public."GatewayPaymentEvent" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(status,"valId","bankId","dueAt",state) ON public."GatewayPayment" TO flywithsafe_phase2_booking_test;
GRANT UPDATE(state) ON public."GatewayRefund" TO flywithsafe_phase2_booking_test;
GRANT EXECUTE ON FUNCTION public.gateway_payment_immutable(),public.gateway_refund_reserve() TO flywithsafe_phase2_booking_test;
COMMIT;
