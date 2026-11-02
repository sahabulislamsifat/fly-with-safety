DO $retained$
BEGIN
 IF (SELECT count(*) FROM public."User" WHERE id IN ('d8505f78-a138-405e-a750-b23d82af87ad','701fb225-e21e-4901-8663-81590207a66f','7ca1205c-0844-40d7-abff-74da4974a8de','8948d02b-8f17-4e2c-aa35-3875420da1cb'))<>4
 OR (SELECT count(*) FROM public."User" WHERE id NOT IN ('d8505f78-a138-405e-a750-b23d82af87ad','701fb225-e21e-4901-8663-81590207a66f','7ca1205c-0844-40d7-abff-74da4974a8de','8948d02b-8f17-4e2c-aa35-3875420da1cb'))<>6
 OR (SELECT count(*) FROM public."Session")<>1
 OR EXISTS(SELECT FROM (VALUES ('d8505f78-a138-405e-a750-b23d82af87ad','CUSTOMER'),('701fb225-e21e-4901-8663-81590207a66f','CUSTOMER'),('7ca1205c-0844-40d7-abff-74da4974a8de','STAFF'),('8948d02b-8f17-4e2c-aa35-3875420da1cb','ADMIN')) expected(id,role)
 WHERE NOT EXISTS(SELECT FROM public."User" u WHERE u.id=expected.id AND u.role::text=expected.role AND u.email=expected.id||'@example.invalid' AND u."emailVerified"))
 THEN RAISE EXCEPTION 'PHASE3_RETAINED_ACTOR_OR_UNLISTED_COUNTS_MISMATCH'; END IF;
 IF (SELECT count(*) FROM public."Booking" WHERE id IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e'))<>2
 OR EXISTS(SELECT FROM (VALUES ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','FWS-P3-DF9912FD'),('b79d19e7-8539-4037-9892-47ebed0f1f5e','FWS-P3-B79D19E7')) expected(id,reference)
 WHERE NOT EXISTS(SELECT FROM public."Booking" b WHERE b.id=expected.id AND b."referenceNumber"=expected.reference
 AND b."userId"='d8505f78-a138-405e-a750-b23d82af87ad' AND b.status='PENDING' AND b.currency='BDT' AND b."totalPrice"=12000
 AND b."customerEmail"='d8505f78-a138-405e-a750-b23d82af87ad@example.invalid' AND b."customerPhone"='01000000000'
 AND b."bookingDetails"->'integrationFixture'='{"phase":3,"provider":"MOCK_ONLY"}'::jsonb AND NOT b."bookingDetails" ? 'gatewayPayment'
 AND b."bookingDetails"->'commercial'->>'version'='1' AND b."bookingDetails"->'commercial'->>'revision'='2'
 AND jsonb_array_length(b."bookingDetails"->'commercial'->'quotes')=1
 AND b."bookingDetails"->'commercial'->'quotes'->0->>'acceptedAt' IS NOT NULL
 AND b."bookingDetails"->'commercial'->'quotes'->0->>'currency'='BDT'
 AND b."bookingDetails"->'commercial'->'quotes'->0->>'amount'='12000'
 AND (b."bookingDetails"->'commercial'->'quotes'->0->>'validUntil')::timestamptz>clock_timestamp()+interval '90 seconds'
 AND b."bookingDetails"->'commercial'->'payments'='[]'::jsonb AND b."bookingDetails"->'commercial'->'receipts'='[]'::jsonb))
 THEN RAISE EXCEPTION 'PHASE3_RETAINED_BOOKING_OR_QUOTE_WINDOW_MISMATCH_NO_REFRESH'; END IF;
 IF (SELECT count(*) FROM public."BookingPassenger" WHERE "bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e'))<>2
 OR EXISTS(SELECT FROM (VALUES ('620888a7-4eac-4b43-9175-e8ffdcf0b614','df9912fd-492c-4d38-a5a8-fa26e6d947ac'),('5d6183db-5ea5-49ed-9b3c-605ae8d467ad','b79d19e7-8539-4037-9892-47ebed0f1f5e')) expected(id,booking)
 WHERE NOT EXISTS(SELECT FROM public."BookingPassenger" p WHERE p.id=expected.id AND p."bookingId"=expected.booking AND p."firstName"='Synthetic' AND p."lastName"='Traveller' AND p."passengerType"='adult'))
 THEN RAISE EXCEPTION 'PHASE3_RETAINED_PASSENGER_MISMATCH'; END IF;
 IF (SELECT count(*) FROM public."BookingStatusHistory" WHERE "bookingId" IN ('df9912fd-492c-4d38-a5a8-fa26e6d947ac','b79d19e7-8539-4037-9892-47ebed0f1f5e'))<>2
 OR EXISTS(SELECT FROM (VALUES ('60d43611-9967-47e9-8ceb-1d5fedb2ad3c','df9912fd-492c-4d38-a5a8-fa26e6d947ac'),('68584d87-fe22-4c35-85b0-fab2517b45bc','b79d19e7-8539-4037-9892-47ebed0f1f5e')) expected(id,booking)
 WHERE NOT EXISTS(SELECT FROM public."BookingStatusHistory" h WHERE h.id=expected.id AND h."bookingId"=expected.booking AND h."fromStatus"='PENDING' AND h."toStatus"='PENDING' AND h."changedBy"='d8505f78-a138-405e-a750-b23d82af87ad' AND h.reason='Synthetic Phase3 accepted-quote fixture prestate; no provider action'))
 OR EXISTS(SELECT FROM public."NotificationOutbox" WHERE payload->'params'->>'referenceNumber' IN ('FWS-P3-DF9912FD','FWS-P3-B79D19E7'))
 THEN RAISE EXCEPTION 'PHASE3_RETAINED_HISTORY_OR_OUTBOX_MISMATCH'; END IF;
END $retained$;
SELECT 'PHASE3_RETAINED_OWNERSHIP_QUOTE_WINDOW_PASS';
