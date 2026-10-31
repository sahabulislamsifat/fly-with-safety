-- PREPARATION ONLY. Not in prisma/migrations. No deployment/connection authorization.
-- New stores are inert until selected schema, provider, identity and application integration pass review.
-- No grants, retained-data backfill, default credential import, deletion or down migration.
BEGIN;
CREATE TABLE public."AuthSecurityState" (
  "userId" text PRIMARY KEY REFERENCES public."User"(id) ON DELETE RESTRICT,
  generation integer NOT NULL CHECK (generation >= 0)
);
CREATE TABLE public."ProtectedCredential" (
  id text PRIMARY KEY, "userId" text NOT NULL REFERENCES public."AuthSecurityState"("userId") ON DELETE RESTRICT,
  generation integer NOT NULL CHECK (generation >= 0),
  purpose text NOT NULL CHECK (purpose IN ('verification','reset')),
  digest text NOT NULL UNIQUE CHECK (digest ~ '^[a-f0-9]{64}$'),
  "expiresAt" timestamptz NOT NULL, "consumedAt" timestamptz, "revokedAt" timestamptz,
  "jobId" text NOT NULL UNIQUE,
  UNIQUE(id,"jobId")
);
CREATE TABLE public."ProtectedAuthJob" (
  id text PRIMARY KEY, "credentialId" text NOT NULL UNIQUE,
  envelope jsonb NOT NULL CHECK (jsonb_typeof(envelope)='object' AND envelope->>'version'='1'),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LEASED','SENDING','SUBMITTED','SUPPRESSED','AMBIGUOUS','QUARANTINED')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0), "workerId" text, "leaseUntil" timestamptz,
  FOREIGN KEY ("credentialId",id) REFERENCES public."ProtectedCredential"(id,"jobId") DEFERRABLE INITIALLY DEFERRED,
  UNIQUE(id,"credentialId"),
  CHECK ((state IN ('PENDING','QUARANTINED') AND "workerId" IS NULL AND "leaseUntil" IS NULL) OR
    (state NOT IN ('PENDING','QUARANTINED') AND "workerId" IS NOT NULL AND "leaseUntil" IS NOT NULL))
);
ALTER TABLE public."ProtectedCredential" ADD CONSTRAINT protected_credential_job_binding
  FOREIGN KEY ("jobId",id) REFERENCES public."ProtectedAuthJob"(id,"credentialId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."BookingPassenger" ADD CONSTRAINT passenger_booking_identity UNIQUE(id,"bookingId");
CREATE TABLE public."PassengerSecret" (
  "passengerId" text PRIMARY KEY REFERENCES public."BookingPassenger"(id) ON DELETE RESTRICT,
  "bookingId" text NOT NULL REFERENCES public."Booking"(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0), envelope jsonb NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY ("passengerId","bookingId") REFERENCES public."BookingPassenger"(id,"bookingId") ON DELETE RESTRICT
);
CREATE FUNCTION public.protected_identity_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public."AuthSecurityState" ("userId",generation) VALUES (NEW.id,0);
  ELSIF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public."AuthSecurityState" SET generation=generation+1 WHERE "userId"=NEW.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROTECTED_IDENTITY_NOT_ENROLLED'; END IF;
    UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp()
      WHERE "userId"=NEW.id AND "revokedAt" IS NULL AND "consumedAt" IS NULL;
    UPDATE public."Session" SET "revokedAt"=clock_timestamp() AT TIME ZONE 'UTC'
      WHERE "userId"=NEW.id AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_identity_generation AFTER INSERT OR UPDATE OF email ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.protected_identity_generation();
CREATE FUNCTION public.protected_monotonic_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW.generation<OLD.generation THEN
    RAISE EXCEPTION 'PROTECTED_GENERATION_REGRESSION';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protected_monotonic_generation BEFORE UPDATE ON public."AuthSecurityState"
  FOR EACH ROW EXECUTE FUNCTION public.protected_monotonic_generation();
-- BEFORE ACTIVATION: validate SQL on separately approved target, protected consumption/registration
-- route wiring, retained-account enrollment, grants and Prisma schema mapping.
-- This draft is deliberately not an executable approved migration package.
COMMIT;
