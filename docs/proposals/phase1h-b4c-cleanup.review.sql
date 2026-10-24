-- REVIEW PROPOSAL ONLY. This file contains a DELETE; no execution is approved yet.
-- Requires owner-confirmed run provenance and separate single-record cleanup approval.
-- Do not use psql -a/-e or ECHO=all. No actual identifier or recipient is printed.
\set ON_ERROR_STOP on
\if :{?ownership_confirmed}
\else
\echo 'STOP: private failed-run ownership confirmation is required.'
\quit
\endif
\if :{?cleanup_approved}
\else
\echo 'STOP: separate cleanup approval is required.'
\quit
\endif
SELECT :'ownership_confirmed'='failed-run-2026-10-23T10:25:18.801Z'
 AND :'cleanup_approved'='single-reviewed-notification-only' AS approved \gset
\if :approved
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog;
DO $cleanup$
DECLARE
  selected_id text;
  affected bigint;
BEGIN
  IF current_database()<>'flywithsafe_phase1h_integration' OR current_user<>'postgres'
    OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1'
    OR inet_server_port() IS DISTINCT FROM 5432 THEN
    RAISE EXCEPTION 'Target identity mismatch';
  END IF;
  -- Freeze the reviewed state for this short transaction; never kill blockers.
  LOCK TABLE public."NotificationOutbox", public."User", public."EmailVerificationToken",
    public."Session", public."FlightInquiry", public."Booking", public."IdempotencyRecord"
    IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT count(*) FROM public."NotificationOutbox")<>1
    OR EXISTS(SELECT 1 FROM public."User")
    OR EXISTS(SELECT 1 FROM public."EmailVerificationToken")
    OR EXISTS(SELECT 1 FROM public."Session")
    OR EXISTS(SELECT 1 FROM public."FlightInquiry")
    OR EXISTS(SELECT 1 FROM public."Booking")
    OR EXISTS(SELECT 1 FROM public."IdempotencyRecord") THEN
    RAISE EXCEPTION 'Reviewed record counts changed';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid='public."NotificationOutbox"'::regclass AND NOT tgisinternal)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint
      WHERE contype='f' AND confrelid='public."NotificationOutbox"'::regclass) THEN
    RAISE EXCEPTION 'Unreviewed notification deletion side effects';
  END IF;
  SELECT id INTO STRICT selected_id FROM public."NotificationOutbox"
  WHERE md5(id)='16be3863bbf2c88d2b5d3ac99d4465c2'
    AND md5(recipient)='526e704c2620c76d589e78bf5a7c2906'
    AND status='PENDING' AND attempts=0 AND "idempotencyKey" IS NULL
    AND "createdAt"=TIMESTAMP '2026-10-23 10:25:29.338'
    AND "updatedAt"=TIMESTAMP '2026-10-23 10:25:29.338'
    AND payload->>'template'='EMAIL_VERIFICATION'
    AND recipient ~ '^idem-[0-9]{13}-[a-z0-9]{1,6}-auth@integration[.]test$'
    AND substring(recipient FROM '^idem-([0-9]{13})-')='1792751118801';
  -- Use the internally resolved primary key, never a prefix/fingerprint-only deletion.
  DELETE FROM public."NotificationOutbox" WHERE id=selected_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>1 OR EXISTS(SELECT 1 FROM public."NotificationOutbox") THEN
    RAISE EXCEPTION 'Unexpected deletion result';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Cleanup refused (SQLSTATE %); transaction must roll back.', SQLSTATE;
END;
$cleanup$;
COMMIT;
\else
\echo 'STOP: approval or ownership confirmation did not match.'
\endif
