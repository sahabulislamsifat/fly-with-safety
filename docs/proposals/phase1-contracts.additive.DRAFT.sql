-- UNEXECUTED: apply only after the three preceding reviewed additive drafts.
-- SQL is authoritative for checks, partial indexes, deferrability and trigger constraints.
BEGIN;
-- Distinguish security-state existence from completed legacy retirement.
ALTER TABLE public."AuthSecurityState" ADD COLUMN "legacyRetiredAt" timestamptz;
CREATE FUNCTION public.protected_enrollment_monotonic() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."legacyRetiredAt" IS NOT NULL AND NEW."legacyRetiredAt" IS DISTINCT FROM OLD."legacyRetiredAt" THEN
    RAISE EXCEPTION 'PROTECTED_ENROLLMENT_REGRESSION';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_enrollment_monotonic BEFORE UPDATE ON public."AuthSecurityState"
  FOR EACH ROW EXECUTE FUNCTION public.protected_enrollment_monotonic();
-- Preserve legacy email-update behavior until that account is explicitly retired.
-- No protected issuance/consume/send may admit a NULL retirement marker.
CREATE OR REPLACE FUNCTION public.protected_identity_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public."AuthSecurityState" ("userId",generation) VALUES (NEW.id,0);
  ELSIF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public."AuthSecurityState" SET generation=generation+1
      WHERE "userId"=NEW.id AND "legacyRetiredAt" IS NOT NULL;
    IF NOT FOUND THEN RETURN NEW; END IF;
    UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp()
      WHERE "userId"=NEW.id AND "revokedAt" IS NULL AND "consumedAt" IS NULL;
    UPDATE public."Session" SET "revokedAt"=clock_timestamp() AT TIME ZONE 'UTC'
      WHERE "userId"=NEW.id AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
-- Explicit defining-side keys required by Prisma's compound one-to-one mappings.
ALTER TABLE public."ProtectedCredential" ADD UNIQUE("jobId",id);
ALTER TABLE public."ProtectedAuthJob" ADD UNIQUE("credentialId",id);
ALTER TABLE public."PassengerSecret" ADD UNIQUE("passengerId","bookingId");
CREATE UNIQUE INDEX protected_one_live_purpose ON public."ProtectedCredential" ("userId",purpose)
  WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX protected_credential_subject_lookup ON public."ProtectedCredential" ("userId",generation);
CREATE INDEX protected_job_dispatch ON public."ProtectedAuthJob" (state,"createdAt",id);
CREATE INDEX passenger_secret_booking ON public."PassengerSecret" ("bookingId");
CREATE INDEX issuance_receipt_subject ON public."AuthIssuanceRequest" ("credentialId","userId");
CREATE INDEX issuance_receipt_job ON public."AuthIssuanceRequest" ("credentialId","jobId");
CREATE INDEX issuance_receipt_session ON public."AuthIssuanceRequest" ("sessionId","userId");

CREATE FUNCTION public.protected_envelope_shape(value jsonb) RETURNS boolean
  LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(value)='object'
    AND value - ARRAY['version','keyRef','nonce','ciphertext','tag'] = '{}'::jsonb
    AND value ?& ARRAY['version','keyRef','nonce','ciphertext','tag']
    AND value->'version'='1'::jsonb
    AND jsonb_typeof(value->'keyRef')='string' AND value->>'keyRef' ~ '^[A-Za-z0-9_-]{1,64}$'
    AND jsonb_typeof(value->'nonce')='string' AND value->>'nonce' ~ '^[A-Za-z0-9_-]{16}$'
    AND jsonb_typeof(value->'tag')='string' AND value->>'tag' ~ '^[A-Za-z0-9_-]{22}$'
    AND jsonb_typeof(value->'ciphertext')='string'
    AND char_length(value->>'ciphertext') BETWEEN 1 AND 5500
    AND value->>'ciphertext' !~ '[^A-Za-z0-9_-]'
$$;
ALTER TABLE public."ProtectedAuthJob" ADD CONSTRAINT protected_job_envelope_shape
  CHECK (COALESCE(public.protected_envelope_shape(envelope),false));
ALTER TABLE public."PassengerSecret" ADD CONSTRAINT passenger_envelope_shape
  CHECK (COALESCE(public.protected_envelope_shape(envelope),false));

CREATE FUNCTION public.protected_credential_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."userId",NEW.generation,NEW.purpose,NEW.digest,NEW."expiresAt",NEW."jobId")
    IS DISTINCT FROM ROW(OLD.id,OLD."userId",OLD.generation,OLD.purpose,OLD.digest,OLD."expiresAt",OLD."jobId")
    OR (OLD."consumedAt" IS NOT NULL AND NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt")
    OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt") THEN
    RAISE EXCEPTION 'PROTECTED_CREDENTIAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_credential_immutable BEFORE UPDATE ON public."ProtectedCredential"
  FOR EACH ROW EXECUTE FUNCTION public.protected_credential_immutable();

CREATE FUNCTION public.protected_job_fencing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."credentialId",NEW.envelope,NEW."createdAt")
    IS DISTINCT FROM ROW(OLD.id,OLD."credentialId",OLD.envelope,OLD."createdAt") OR NOT (
    (OLD.state IN ('PENDING','LEASED') AND NEW.state IN ('LEASED','QUARANTINED') AND NEW.version=OLD.version+1)
    OR (OLD.state='LEASED' AND NEW.state='SENDING' AND NEW.version=OLD.version
      AND NEW."workerId"=OLD."workerId" AND NEW."leaseUntil"=OLD."leaseUntil")
    OR (OLD.state='SENDING' AND NEW.state IN ('SUBMITTED','SUPPRESSED','AMBIGUOUS') AND NEW.version=OLD.version
      AND NEW."workerId"=OLD."workerId" AND NEW."leaseUntil"=OLD."leaseUntil")) THEN
    RAISE EXCEPTION 'PROTECTED_JOB_FENCE_INVALID';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_job_fencing BEFORE UPDATE ON public."ProtectedAuthJob"
  FOR EACH ROW EXECUTE FUNCTION public.protected_job_fencing();

CREATE FUNCTION public.passenger_secret_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."passengerId"<>OLD."passengerId" OR NEW."bookingId"<>OLD."bookingId" OR NEW.revision<>OLD.revision+1 THEN
    RAISE EXCEPTION 'PASSENGER_REVISION_INVALID';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER passenger_secret_revision BEFORE UPDATE ON public."PassengerSecret"
  FOR EACH ROW EXECUTE FUNCTION public.passenger_secret_revision();
-- No backfill, legacy-token import, data erasure, grants, route activation or automatic recovery.
COMMIT;
