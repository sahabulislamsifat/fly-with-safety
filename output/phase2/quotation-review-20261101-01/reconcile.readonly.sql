\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='2s';
DO $guard$
BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration'
 OR current_user<>'flywithsafe_phase2_booking_test' OR session_user<>'flywithsafe_phase2_booking_test'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'PHASE2_QUOTATION_REVIEW_WRONG_IDENTITY'; END IF;
END $guard$;
SELECT current_database() AS database_name,current_user AS role_name,current_setting('TimeZone') AS session_timezone,
 clock_timestamp()::text AS server_timestamp,(clock_timestamp() AT TIME ZONE 'UTC')::text AS database_utc_timestamp;

WITH expected(id,role_name) AS (VALUES
 ('7a504831-759c-4c1c-8325-4a187f711d91','CUSTOMER'),('e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','CUSTOMER'),
 ('698a9431-d269-4c63-ae57-23e14503d477','STAFF'),('76374639-4185-4f99-a451-155c2250503d','ADMIN'))
SELECT 'User' AS table_name,4 AS expected_rows,
 (SELECT count(*) FROM public."User" u JOIN expected e ON u.id=e.id AND u.role::text=e.role_name AND u.email=e.id||'@example.invalid') AS matched_rows,
 (SELECT count(*) FROM public."User") AS total_rows
UNION ALL SELECT 'Session',4,
 (SELECT count(*) FROM public."Session" s JOIN (VALUES
 ('cmvxtcwrn0000q4f4ym1qxcn5','7a504831-759c-4c1c-8325-4a187f711d91'),
 ('cmvxtcwz00001q4f4pukspax6','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6'),
 ('cmvxtcx680002q4f4sdhkii3t','698a9431-d269-4c63-ae57-23e14503d477'),
 ('cmvxtcxda0003q4f4ktzdgsfs','76374639-4185-4f99-a451-155c2250503d')) e(id,user_id) ON s.id=e.id AND s."userId"=e.user_id),
 (SELECT count(*) FROM public."Session")
UNION ALL SELECT 'Booking',1,
 (SELECT count(*) FROM public."Booking" WHERE id='cmvxtcxe80004q4f4e7e9rceb' AND "referenceNumber"='FWS-2026-53YFS3' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91'),
 (SELECT count(*) FROM public."Booking")
UNION ALL SELECT 'BookingPassenger',1,
 (SELECT count(*) FROM public."BookingPassenger" WHERE id='cmvxtcxeb0005q4f4lxyq0c21' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb'),
 (SELECT count(*) FROM public."BookingPassenger")
UNION ALL SELECT 'BookingStatusHistory',1,
 (SELECT count(*) FROM public."BookingStatusHistory" WHERE id='cmvxtcxee0006q4f43zuw60dt' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb'),
 (SELECT count(*) FROM public."BookingStatusHistory")
UNION ALL SELECT 'IdempotencyRecord',1,
 (SELECT count(*) FROM public."IdempotencyRecord" WHERE id='cmvxtcxek0007q4f4yqrnouxi' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND "referenceNumber"='FWS-2026-53YFS3'),
 (SELECT count(*) FROM public."IdempotencyRecord")
UNION ALL SELECT 'NotificationOutbox',1,
 (SELECT count(*) FROM public."NotificationOutbox" WHERE id='cmvxtcxf20008q4f4hr0mqb79' AND recipient='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid'),
 (SELECT count(*) FROM public."NotificationOutbox");

WITH stored AS (SELECT status,"totalPrice","bookingDetails"->'commercial' AS commercial
 FROM public."Booking" WHERE id='cmvxtcxe80004q4f4e7e9rceb' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91'),
 shaped AS (SELECT *,CASE WHEN jsonb_typeof(commercial->'quotes')='array' THEN commercial->'quotes' ELSE '[]'::jsonb END AS quotes,
 CASE WHEN jsonb_typeof(commercial->'payments')='array' THEN commercial->'payments' ELSE '[]'::jsonb END AS payments,
 CASE WHEN jsonb_typeof(commercial->'receipts')='array' THEN commercial->'receipts' ELSE '[]'::jsonb END AS receipts FROM stored)
SELECT status,"totalPrice",commercial IS NOT NULL AS commercial_present,commercial->>'revision' AS commercial_revision,
 jsonb_array_length(quotes) AS quotation_count,jsonb_array_length(payments) AS payment_count,jsonb_array_length(receipts) AS receipt_count,
 (SELECT count(*) FROM jsonb_array_elements(quotes) q WHERE q->'acceptedAt' IS NOT NULL AND q->'acceptedAt'<>'null'::jsonb) AS accepted_quotation_count
FROM shaped;
WITH owned AS (SELECT "bookingDetails"->'commercial'->'quotes' AS quotes FROM public."Booking"
 WHERE id='cmvxtcxe80004q4f4e7e9rceb' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91')
SELECT q->>'id' AS quotation_id,q->>'amount' AS amount,q->>'currency' AS currency,q->>'validUntil' AS valid_until,
 q->>'createdAt' AS created_at,q->>'acceptedAt' AS accepted_at
FROM owned CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(quotes)='array' THEN quotes ELSE '[]'::jsonb END) q;
SELECT 'PHASE2_QUOTATION_READONLY_INVENTORY_RECORDED_REQUIRES_REVIEW' AS result;
ROLLBACK;
