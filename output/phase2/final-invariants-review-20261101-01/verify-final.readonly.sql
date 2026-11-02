\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='2s';
DO $guard$
BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'flywithsafe_phase2_booking_test'
 OR session_user<>'flywithsafe_phase2_booking_test' OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
 OR inet_server_port() IS DISTINCT FROM 5432 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'PHASE2_FINAL_STATE_WRONG_IDENTITY'; END IF;
END $guard$;
WITH expected_users(id,email,role) AS (VALUES ('7a504831-759c-4c1c-8325-4a187f711d91','7a504831-759c-4c1c-8325-4a187f711d91@example.invalid','CUSTOMER'),
('e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6@example.invalid','CUSTOMER'),
('698a9431-d269-4c63-ae57-23e14503d477','698a9431-d269-4c63-ae57-23e14503d477@example.invalid','STAFF'),
('76374639-4185-4f99-a451-155c2250503d','76374639-4185-4f99-a451-155c2250503d@example.invalid','ADMIN')),
expected_sessions(id,user_id) AS (VALUES ('cmvxtcwrn0000q4f4ym1qxcn5','7a504831-759c-4c1c-8325-4a187f711d91'),
('cmvxtcwz00001q4f4pukspax6','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6'),
('cmvxtcx680002q4f4sdhkii3t','698a9431-d269-4c63-ae57-23e14503d477'),
('cmvxtcxda0003q4f4ktzdgsfs','76374639-4185-4f99-a451-155c2250503d'),
('cmvxzb07h0000ucf4hfq0bxok','7a504831-759c-4c1c-8325-4a187f711d91'),
('cmvxzb0ez0001ucf4gtc5l61h','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6'),
('cmvxzb0m50002ucf47xrprkkq','698a9431-d269-4c63-ae57-23e14503d477'),
('cmvxzb0t90003ucf4vs8murjr','76374639-4185-4f99-a451-155c2250503d'),
('cmvxzb3rf0009ucf4skt9ngjk','7a504831-759c-4c1c-8325-4a187f711d91')),
expected_history(id) AS (VALUES ('cmvxtcxee0006q4f43zuw60dt'),
('cmvxzb3930004ucf4kr4rnpqy'),
('cmvxzb3e30005ucf46kldngun'),
('cmvxzb3g30007ucf4vemq7gq0')),
expected_outbox(id) AS (VALUES ('cmvxtcxf20008q4f4hr0mqb79'),
('cmvxzb3eb0006ucf4icuoxdcu'),
('cmvxzb3g70008ucf4tpebixcr')),
expected_quotes(id) AS (VALUES ('d2b23d02-adb7-423a-8458-248fadd9b669'),
('87b9d786-e51b-4c41-a429-d96de3cf03a7'),
('58b4daf8-c952-4f38-8c36-93ae8ae29389')),
expected_receipts(id,actor) AS (VALUES ('d2b23d02-adb7-423a-8458-248fadd9b669','698a9431-d269-4c63-ae57-23e14503d477'),
('87b9d786-e51b-4c41-a429-d96de3cf03a7','698a9431-d269-4c63-ae57-23e14503d477'),
('58b4daf8-c952-4f38-8c36-93ae8ae29389','698a9431-d269-4c63-ae57-23e14503d477'),
('9e3da892-2951-4344-becb-a2117f7808fa','7a504831-759c-4c1c-8325-4a187f711d91'),
('9716680f-f5a3-41e9-9ee6-3448d02773bc','698a9431-d269-4c63-ae57-23e14503d477')),
b AS (SELECT *,"bookingDetails"->'commercial' AS commercial FROM public."Booking" WHERE id='cmvxtcxe80004q4f4e7e9rceb'),
h AS (SELECT * FROM public."BookingStatusHistory" WHERE "bookingId"='cmvxtcxe80004q4f4e7e9rceb'),
q AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'quotes')='array' THEN commercial->'quotes' ELSE '[]'::jsonb END)),
p AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'payments')='array' THEN commercial->'payments' ELSE '[]'::jsonb END)),
r AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'receipts')='array' THEN commercial->'receipts' ELSE '[]'::jsonb END)),
checks(invariant,expected,observed) AS (VALUES
('users','4'::jsonb,to_jsonb((SELECT count(*)::int FROM public."User"))),
('sessions','9'::jsonb,to_jsonb((SELECT count(*)::int FROM public."Session"))),
('bookings','1'::jsonb,to_jsonb((SELECT count(*)::int FROM public."Booking"))),
('passengers','1'::jsonb,to_jsonb((SELECT count(*)::int FROM public."BookingPassenger"))),
('history','4'::jsonb,to_jsonb((SELECT count(*)::int FROM public."BookingStatusHistory"))),
('idempotency','1'::jsonb,to_jsonb((SELECT count(*)::int FROM public."IdempotencyRecord"))),
('notifications','3'::jsonb,to_jsonb((SELECT count(*)::int FROM public."NotificationOutbox"))),
('userOwnership','true'::jsonb,to_jsonb((SELECT count(*)=4 FROM public."User" u JOIN expected_users e ON u.id=e.id AND u.email=e.email AND u.role::text=e.role AND u."emailVerified"))),
('sessionOwnership','true'::jsonb,to_jsonb((SELECT count(*)=9 FROM public."Session" s JOIN expected_sessions e ON s.id=e.id AND s."userId"=e.user_id))),
('bookingOwnership','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM b WHERE "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND "referenceNumber"='FWS-2026-53YFS3' AND currency='BDT'))),
('bookingStatus','"COMPLETED"'::jsonb,to_jsonb((SELECT CASE WHEN status='COMPLETED' THEN 'COMPLETED' ELSE 'OTHER' END FROM b))),
('totalPrice','12000'::jsonb,to_jsonb((SELECT "totalPrice" FROM b))),
('passengerOwnership','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM public."BookingPassenger" WHERE id='cmvxtcxeb0005q4f4lxyq0c21' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "firstName"='Synthetic' AND "lastName"='Traveller' AND "passengerType"='adult'))),
('historyExactIds','true'::jsonb,to_jsonb((SELECT count(*)=4 FROM h JOIN expected_history e ON h.id=e.id))),
('historyCount','4'::jsonb,to_jsonb((SELECT count(*)::int FROM h))),
('historyTimestampsPresent','true'::jsonb,to_jsonb((SELECT count("createdAt")=4 FROM h))),
('initialHistoryContract','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM h WHERE id='cmvxtcxee0006q4f43zuw60dt' AND "fromStatus"='PENDING' AND "toStatus"='PENDING' AND "changedBy"='CUSTOMER' AND reason='Initial booking submission'))),
('acceptanceActor','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM h WHERE "fromStatus"='PENDING' AND "toStatus"='PENDING' AND reason='Quotation accepted; awaiting staff processing' AND "changedBy"='7a504831-759c-4c1c-8325-4a187f711d91'))),
('statusTransitionCount','2'::jsonb,to_jsonb((SELECT count(*)::int FROM h WHERE "fromStatus"<>"toStatus"))),
('statusActors','"STAFF_EMAIL"'::jsonb,to_jsonb((SELECT CASE WHEN count(*)=0 THEN 'MISSING' WHEN count(*)=2 AND bool_and(coalesce("changedBy"='698a9431-d269-4c63-ae57-23e14503d477@example.invalid',false)) THEN 'STAFF_EMAIL' WHEN count(*)=2 AND bool_and(coalesce("changedBy"='698a9431-d269-4c63-ae57-23e14503d477',false)) THEN 'STAFF_ID' ELSE 'OTHER' END FROM h WHERE "fromStatus"<>"toStatus"))),
('confirmationAudit','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM h WHERE "fromStatus"='PENDING' AND "toStatus"='CONFIRMED' AND "changedBy"='698a9431-d269-4c63-ae57-23e14503d477@example.invalid' AND reason='Synthetic continuation verification'))),
('completionAudit','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM h WHERE "fromStatus"='CONFIRMED' AND "toStatus"='COMPLETED' AND "changedBy"='698a9431-d269-4c63-ae57-23e14503d477@example.invalid' AND reason='Synthetic continuation verification'))),
('idempotencyOwnership','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM public."IdempotencyRecord" WHERE id='cmvxtcxek0007q4f4yqrnouxi' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND "referenceNumber"='FWS-2026-53YFS3'))),
('notificationOwnership','true'::jsonb,to_jsonb((SELECT count(*)=3 FROM public."NotificationOutbox" o JOIN expected_outbox e ON o.id=e.id WHERE o.recipient='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid' AND o.payload->'params'->>'referenceNumber'='FWS-2026-53YFS3'))),
('confirmationNotification','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM public."NotificationOutbox" WHERE id='cmvxtcxf20008q4f4hr0mqb79' AND payload->>'template'='BOOKING_CONFIRMATION'))),
('notification_CONFIRMED','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM public."NotificationOutbox" o JOIN expected_outbox e ON o.id=e.id WHERE o.payload->>'template'='BOOKING_STATUS' AND o.payload->'params'->>'status'='CONFIRMED'))),
('notification_COMPLETED','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM public."NotificationOutbox" o JOIN expected_outbox e ON o.id=e.id WHERE o.payload->>'template'='BOOKING_STATUS' AND o.payload->'params'->>'status'='COMPLETED'))),
('commercialVersion','true'::jsonb,to_jsonb((SELECT commercial->'version'='1'::jsonb AND commercial->'revision'='5'::jsonb FROM b))),
('quoteCount','3'::jsonb,to_jsonb((SELECT count(*)::int FROM q))),
('quoteExactIds','true'::jsonb,to_jsonb((SELECT count(*)=3 AND count(DISTINCT q.data->>'id')=3 FROM q JOIN expected_quotes e ON q.data->>'id'=e.id))),
('acceptedQuoteCount','1'::jsonb,to_jsonb((SELECT count(*)::int FROM q WHERE data->>'acceptedAt' IS NOT NULL))),
('acceptedQuoteLink','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM q WHERE data->>'id'='58b4daf8-c952-4f38-8c36-93ae8ae29389' AND data->>'acceptedAt' IS NOT NULL AND data->'amount'='12000'::jsonb AND data->>'currency'='BDT'))),
('paymentCount','1'::jsonb,to_jsonb((SELECT count(*)::int FROM p))),
('unverifiedPaymentLink','true'::jsonb,to_jsonb((SELECT count(*)=1 FROM p WHERE data->>'id'='9716680f-f5a3-41e9-9ee6-3448d02773bc' AND data->>'quoteId'='58b4daf8-c952-4f38-8c36-93ae8ae29389' AND data->'amount'='12000'::jsonb AND data->>'currency'='BDT' AND data->>'status'='RECORDED_UNVERIFIED' AND data->>'method'='BANK_TRANSFER' AND data->>'reference'='SYN-CONT-PAY-001'))),
('receiptCount','5'::jsonb,to_jsonb((SELECT count(*)::int FROM r))),
('receiptIdsAndActors','true'::jsonb,to_jsonb((SELECT count(*)=5 AND count(DISTINCT r.data->>'id')=5 FROM r JOIN expected_receipts e ON r.data->>'id'=e.id AND r.data->>'actor'=e.actor WHERE r.data->>'command' ~ '^sha256:[a-f0-9]{64}$'))),
('noPaymentVerification','true'::jsonb,to_jsonb((SELECT coalesce("bookingDetails"->>'paymentStatus','')<>'PAYMENT_VERIFIED' FROM b))),
('rollbackHistoryAbsent','true'::jsonb,to_jsonb((SELECT count(*)=0 FROM public."BookingStatusHistory" WHERE id='4790b9f9-5f9d-49b4-83e2-04d22d495af8'))),
('rollbackBookingAbsent','true'::jsonb,to_jsonb((SELECT count(*)=0 FROM public."Booking" WHERE id='128a2112-7865-4055-8a3c-07751a7136cb'))))
SELECT jsonb_agg(jsonb_build_object('invariant',invariant,'expected',expected,'observed',observed,'matched',expected IS NOT DISTINCT FROM observed,
 'legacyExpected',CASE WHEN invariant='statusActors' THEN '"STAFF_ID"'::jsonb ELSE NULL END) ORDER BY invariant) AS invariant_results,
 bool_and(expected IS NOT DISTINCT FROM observed) AS all_matched FROM checks
\gset
\echo :invariant_results
ROLLBACK;
\if :all_matched
 \echo PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS
\else
 \echo PHASE2_FINAL_STATE_READONLY_INVARIANT_STOP
 \quit 1
\endif
