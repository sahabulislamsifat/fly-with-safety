-- UNEXECUTED CANDIDATE. Requires protected-schema and replay-recovery drafts.
-- Outside prisma/migrations; no grants, retained-data cleanup, activation or down migration.
BEGIN;
ALTER TABLE public."ProtectedAuthJob" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE TABLE public."CompatibleNotificationLease" (
  "recordId" text PRIMARY KEY REFERENCES public."NotificationOutbox"(id) ON DELETE RESTRICT,
  version timestamp(3) NOT NULL, "workerId" text NOT NULL CHECK ("workerId" ~ '^[A-Za-z0-9_-]{1,128}$'),
  "leaseUntil" timestamptz NOT NULL
);
CREATE TABLE public."NotificationSendIntent" (
  "recordId" text NOT NULL REFERENCES public."NotificationOutbox"(id) ON DELETE RESTRICT,
  version timestamp(3) NOT NULL,
  state text NOT NULL CHECK (state IN ('SENDING','SUBMITTED','SUPPRESSED','AMBIGUOUS')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY("recordId",version)
);
CREATE FUNCTION public.notification_send_intent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."recordId"<>OLD."recordId" OR NEW.version<>OLD.version OR
    (OLD.state<>'SENDING' AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'NOTIFICATION_SEND_INTENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_send_intent_immutable BEFORE UPDATE ON public."NotificationSendIntent"
  FOR EACH ROW EXECUTE FUNCTION public.notification_send_intent_immutable();
-- Application grants must exclude DELETE/DDL/grant options. New worker rollout must cut off old recovery/redrive paths.
COMMIT;
