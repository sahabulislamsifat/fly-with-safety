\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';
DO $identity$
BEGIN
 IF current_database()<>'flywithsafety_local_integration'
 OR current_user<>'flywithsafe_phase2_booking_test'
 OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5432
 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>34701
 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'STOP: read-only identity mismatch'; END IF;
END $identity$;
-- No payload, contact, password/hash, token or connection URL is selected.
SELECT current_database() AS database_name,current_user AS role_name,
 current_setting('TimeZone') AS session_timezone,
 (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS database_oid,
 extract(epoch FROM clock_timestamp())::numeric AS actual_epoch,
 extract(epoch FROM (clock_timestamp() AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'UTC')::numeric AS discarded_offset_epoch;
WITH owned(id,owner_id,reference) AS (VALUES
 ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','d8505f78-a138-405e-a750-b23d82af87ad','FWS-P3-DF9912FD'),
 ('b79d19e7-8539-4037-9892-47ebed0f1f5e','d8505f78-a138-405e-a750-b23d82af87ad','FWS-P3-B79D19E7'))
SELECT o.reference,b.id IS NOT NULL AS present,
 b."userId"=o.owner_id AND b."referenceNumber"=o.reference AS ownership_matches,
 b.status='PENDING' AS status_matches,b.currency='BDT' AS currency_matches,b."totalPrice"=12000 AS amount_matches,
 b."customerPhone" IS NOT NULL AS has_phone,
 b."bookingDetails"->'integrationFixture'= '{"phase":3,"provider":"MOCK_ONLY"}'::jsonb AS fixture_tag_matches,
 jsonb_array_length(b."bookingDetails"->'commercial'->'quotes')=1 AS one_quote,
 b."bookingDetails"->'commercial'->'quotes'->0->>'acceptedAt' IS NOT NULL AS accepted_quote,
 b."bookingDetails"->'commercial'->'quotes'->0->>'currency'='BDT' AS quote_currency_matches,
 (b."bookingDetails"->'commercial'->'quotes'->0->>'amount')::int=12000 AS quote_amount_matches,
 jsonb_array_length(b."bookingDetails"->'commercial'->'payments')=0 AS no_manual_payment,
 round(extract(epoch FROM ((b."bookingDetails"->'commercial'->'quotes'->0->>'validUntil')::timestamptz-clock_timestamp()))) AS expiry_seconds_remaining,
 (b."bookingDetails"->'commercial'->'quotes'->0->>'validUntil')::timestamptz>clock_timestamp() AS future_at_actual_instant,
 (b."bookingDetails"->'commercial'->'quotes'->0->>'validUntil')::timestamptz>(clock_timestamp() AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'UTC' AS future_if_offset_discarded
FROM owned o LEFT JOIN public."Booking" b ON b.id=o.id ORDER BY o.reference;
SELECT 'User' AS kind,count(*)::int AS owned_count FROM public."User" WHERE id IN ('d8505f78-a138-405e-a750-b23d82af87ad','701fb225-e21e-4901-8663-81590207a66f','7ca1205c-0844-40d7-abff-74da4974a8de','8948d02b-8f17-4e2c-aa35-3875420da1cb')
UNION ALL SELECT 'Booking',count(*)::int FROM public."Booking" WHERE id IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'BookingPassenger',count(*)::int FROM public."BookingPassenger" WHERE "bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'BookingStatusHistory',count(*)::int FROM public."BookingStatusHistory" WHERE "bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'GatewayPayment',count(*)::int FROM public."GatewayPayment" WHERE "bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'GatewayPaymentEvent',count(*)::int FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'GatewayRefund',count(*)::int FROM public."GatewayRefund" r JOIN public."GatewayPayment" p ON p.id=r."paymentId" WHERE p."bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e')
UNION ALL SELECT 'NotificationOutbox',count(*)::int FROM public."NotificationOutbox" WHERE payload->'params'->>'referenceNumber' IN ('FWS-P3-DF9912FD','FWS-P3-B79D19E7')
UNION ALL SELECT 'UnlistedUser',count(*)::int FROM public."User" WHERE id NOT IN ('d8505f78-a138-405e-a750-b23d82af87ad','701fb225-e21e-4901-8663-81590207a66f','7ca1205c-0844-40d7-abff-74da4974a8de','8948d02b-8f17-4e2c-aa35-3875420da1cb')
UNION ALL SELECT 'Session',count(*)::int FROM public."Session";
SELECT count(*)::int AS completed_migrations FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
ROLLBACK;
\echo PHASE3_CLOCK_FIXTURE_READONLY_FINISHED_NOT_PAYMENT_PROOF
