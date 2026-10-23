-- Metadata/fingerprints only. No recipient, payload, token, URL, name or password output.
\set ON_ERROR_STOP on
\pset pager off
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SELECT current_database()='flywithsafe_phase1h_integration'
 AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND current_user='postgres' AS target_ok \gset
\if :target_ok
SELECT current_database() AS database, current_user AS role,
 host(inet_server_addr()) AS host, inet_server_port() AS port,
 current_setting('transaction_read_only') AS read_only;
SELECT to_regclass('public."NotificationOutbox"') AS outbox_table;
SELECT md5(n.id) AS record_fingerprint, md5(n.recipient) AS recipient_fingerprint,
 n.status, n."createdAt", n."updatedAt", n.attempts,
 n."idempotencyKey" IS NOT NULL AS has_idempotency_key,
 n.payload->>'template'='EMAIL_VERIFICATION' AS verification_template,
 n.recipient ~ '^idem-[0-9]{13}-[a-z0-9]{1,6}-auth@integration[.]test$' AS inquiry_setup_pattern,
 CASE WHEN n.recipient ~ '^idem-[0-9]{13}-[a-z0-9]{1,6}-auth@integration[.]test$'
 THEN to_timestamp(substring(n.recipient FROM '^idem-([0-9]{13})-')::double precision/1000)
 END AS candidate_run_started_at,
 (SELECT count(*) FROM public."User" u WHERE u.email=n.recipient) AS matching_users,
 (SELECT count(*) FROM public."FlightInquiry" f WHERE f.email=n.recipient) AS matching_inquiries,
 (SELECT count(*) FROM public."Booking" b WHERE b."customerEmail"=n.recipient) AS matching_bookings
FROM public."NotificationOutbox" n ORDER BY n."createdAt";
SELECT (SELECT count(*) FROM public."NotificationOutbox") AS notifications,
 (SELECT count(*) FROM public."User") AS users,
 (SELECT count(*) FROM public."EmailVerificationToken") AS verification_tokens,
 (SELECT count(*) FROM public."Session") AS sessions,
 (SELECT count(*) FROM public."FlightInquiry") AS flight_inquiries,
 (SELECT count(*) FROM public."Booking") AS bookings,
 (SELECT count(*) FROM public."IdempotencyRecord") AS idempotency_records;
SELECT md5(u.id) AS user_fingerprint, md5(u.email) AS email_fingerprint, u."createdAt",
 u.email ~ '^idem-[0-9]{13}-[a-z0-9]{1,6}-auth@integration[.]test$' AS inquiry_setup_pattern,
 u.email ~ '^reliability-[0-9a-f-]{36}-[ab]@example[.]test$' AS reliability_setup_pattern,
 (SELECT count(*) FROM public."EmailVerificationToken" t WHERE t."userId"=u.id) AS verification_tokens,
 (SELECT count(*) FROM public."Session" s WHERE s."userId"=u.id) AS sessions
FROM public."User" u ORDER BY u."createdAt";
SELECT md5(id) AS inquiry_fingerprint, md5(email) AS email_fingerprint, "createdAt"
FROM public."FlightInquiry" ORDER BY "createdAt";
SELECT md5(id) AS booking_fingerprint, md5("customerEmail") AS email_fingerprint, "createdAt"
FROM public."Booking" ORDER BY "createdAt";
SELECT md5(id) AS idempotency_fingerprint, md5(key) AS key_fingerprint, "createdAt",
 "userId" IS NOT NULL AS has_user
FROM public."IdempotencyRecord" ORDER BY "createdAt";
\else
\echo 'STOP: target identity mismatch; no forensic tables queried.'
\endif
ROLLBACK;
