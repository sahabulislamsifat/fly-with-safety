-- Private local execution only. Do not use psql -a/-e or ECHO=all.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SELECT current_database()='flywithsafe_phase1h_integration'
 AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND current_user='postgres' AS target_ok \gset
\if :target_ok
-- gset requires exactly one row. The actual ID remains in the private psql variable.
SELECT id AS residual_id FROM public."NotificationOutbox"
WHERE md5(id)='16be3863bbf2c88d2b5d3ac99d4465c2'
 AND md5(recipient)='526e704c2620c76d589e78bf5a7c2906'
 AND status='PENDING' AND attempts=0 AND "idempotencyKey" IS NULL
 AND "createdAt"=TIMESTAMP '2026-10-23 10:25:29.338'
 AND "updatedAt"=TIMESTAMP '2026-10-23 10:25:29.338'
 AND payload->>'template'='EMAIL_VERIFICATION'
 AND recipient ~ '^idem-[0-9]{13}-[a-z0-9]{1,6}-auth@integration[.]test$'
 AND substring(recipient FROM '^idem-([0-9]{13})-')='1792751118801'
\gset
SELECT md5(:'residual_id') AS resolved_fingerprint, true AS exactly_one_private_id_resolved;
\unset residual_id
\else
\echo 'STOP: target mismatch; no record resolved.'
\endif
ROLLBACK;
