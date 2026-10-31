-- UNEXECUTED CANDIDATE. Requires reviewed protected-schema draft first.
-- Outside prisma/migrations; no grants, existing-data mutations or down migration.
BEGIN;
ALTER TABLE public."ProtectedCredential" ADD CONSTRAINT protected_credential_subject UNIQUE(id,"userId");
ALTER TABLE public."Session" ADD CONSTRAINT protected_session_subject UNIQUE(id,"userId");
CREATE TABLE public."AuthIssuanceRequest" (
  "keyHash" text PRIMARY KEY CHECK ("keyHash" ~ '^[a-f0-9]{64}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^h1:[A-Za-z0-9_-]{1,48}:[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('RESERVED','COMMITTED')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(), "completedAt" timestamptz,
  receipt jsonb, "userId" text, "credentialId" text, "jobId" text, "sessionId" text,
  FOREIGN KEY ("credentialId","userId") REFERENCES public."ProtectedCredential"(id,"userId") ON DELETE RESTRICT,
  FOREIGN KEY ("credentialId","jobId") REFERENCES public."ProtectedCredential"(id,"jobId") ON DELETE RESTRICT,
  FOREIGN KEY ("sessionId","userId") REFERENCES public."Session"(id,"userId") ON DELETE RESTRICT,
  CHECK (state='RESERVED' OR ("completedAt" IS NOT NULL AND receipt IS NOT NULL AND jsonb_typeof(receipt)='object'
    AND receipt - ARRAY['operation','userId','credentialId','jobId','sessionId'] = '{}'::jsonb
    AND receipt ?& ARRAY['operation','userId','credentialId','jobId','sessionId']
    AND COALESCE(receipt->>'operation' IN ('register','verification','reset'),false)
    AND (receipt->>'userId') IS NOT DISTINCT FROM "userId"
    AND (receipt->>'credentialId') IS NOT DISTINCT FROM "credentialId"
    AND (receipt->>'jobId') IS NOT DISTINCT FROM "jobId"
    AND (receipt->>'sessionId') IS NOT DISTINCT FROM "sessionId"
    AND (("userId" IS NULL AND receipt->>'operation'<>'register' AND "credentialId" IS NULL AND "jobId" IS NULL AND "sessionId" IS NULL)
      OR ("userId" IS NOT NULL AND "credentialId" IS NOT NULL AND "jobId" IS NOT NULL
        AND ((receipt->>'operation'='register' AND "sessionId" IS NOT NULL)
          OR (receipt->>'operation'<>'register' AND "sessionId" IS NULL))))))
);
CREATE FUNCTION public.protected_request_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."keyHash"<>OLD."keyHash" OR NEW.fingerprint<>OLD.fingerprint OR (OLD.state='COMMITTED' AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'ISSUANCE_REQUEST_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_request_immutable BEFORE UPDATE ON public."AuthIssuanceRequest"
  FOR EACH ROW EXECUTE FUNCTION public.protected_request_immutable();
CREATE FUNCTION public.protected_request_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public."AuthIssuanceRequest" WHERE "keyHash"=NEW."keyHash" AND state<>'COMMITTED') THEN
    RAISE EXCEPTION 'ISSUANCE_REQUEST_INCOMPLETE';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER protected_request_complete AFTER INSERT OR UPDATE ON public."AuthIssuanceRequest"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.protected_request_complete();
CREATE TABLE public."NotificationQuarantine" (
  source text NOT NULL CHECK (source IN ('ordinary','protected')),
  "recordId" text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('LEGACY_AUTH','UNKNOWN_FORMAT','MALFORMED','RESTORED','AMBIGUOUS_SEND')),
  "observedVersion" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(source,"recordId")
);
-- Restored database state cannot attest that its request/revocation history is current.
-- Trusted epoch admission outside the snapshot and a quiesced exact-record manifest are required.
COMMIT;
