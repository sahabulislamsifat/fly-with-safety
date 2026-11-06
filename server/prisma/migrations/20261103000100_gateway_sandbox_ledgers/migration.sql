-- PREPARED ONLY. Not applied to local or cloud. Additional checks/partial index intentionally exceed Prisma's expressible schema.
BEGIN;
CREATE TABLE public."GatewayPayment" (
 id text PRIMARY KEY, "bookingId" text NOT NULL REFERENCES public."Booking"(id) ON DELETE RESTRICT,
 "userId" text NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 "requestId" text NOT NULL, "tranId" varchar(30) NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN ('INITIATING','SESSION_READY','UNKNOWN','VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW','FAILED','CANCELLED','EXPIRED')),
 "valId" text UNIQUE, "bankId" text UNIQUE, "dueAt" timestamptz, state jsonb NOT NULL,
 UNIQUE("userId","requestId"),
 CHECK(jsonb_typeof(state)='object' AND state @> jsonb_build_object('id',id,'bookingId',"bookingId",'userId',"userId",'requestId',"requestId",'tranId',"tranId",'status',status,'currency','BDT')),
 CHECK(state ?& ARRAY['id','bookingId','userId','requestId','tranId','status','currency','amountMinor','captured','quoteId','quoteRevision','digest','checks','due','created','updated']),
 CHECK(jsonb_typeof(state->'amountMinor')='string' AND state->>'amountMinor' ~ '^[1-9][0-9]{0,9}$' AND (state->>'amountMinor')::bigint BETWEEN 1 AND 9999999999),
 CHECK(jsonb_typeof(state->'captured')='boolean'),
 CHECK((status IN ('VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW'))=(state->>'captured')::boolean),
 CHECK((state->>'valId') IS NOT DISTINCT FROM "valId" AND (state->>'bankId') IS NOT DISTINCT FROM "bankId"),
 CHECK(NOT (state->>'captured')::boolean OR ("valId" IS NOT NULL AND "bankId" IS NOT NULL AND status IN ('VERIFIED','RISK_REVIEW','EXCEPTION_REVIEW')))
);
CREATE UNIQUE INDEX "GatewayPayment_one_active_booking" ON public."GatewayPayment"("bookingId") WHERE status IN ('INITIATING','SESSION_READY','UNKNOWN');
CREATE INDEX "GatewayPayment_bookingId_idx" ON public."GatewayPayment"("bookingId");
CREATE INDEX "GatewayPayment_dueAt_idx" ON public."GatewayPayment"("dueAt");
CREATE TABLE public."GatewayPaymentEvent" (
 id text PRIMARY KEY, "paymentId" text NOT NULL REFERENCES public."GatewayPayment"(id) ON DELETE RESTRICT,
 kind text NOT NULL, actor text NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "GatewayPaymentEvent_paymentId_createdAt_idx" ON public."GatewayPaymentEvent"("paymentId","createdAt");
CREATE TABLE public."GatewayRefund" (
 id varchar(30) PRIMARY KEY, "paymentId" text NOT NULL REFERENCES public."GatewayPayment"(id) ON DELETE RESTRICT,
 "requestId" text NOT NULL, "actorId" text NOT NULL, state jsonb NOT NULL,
 UNIQUE("actorId","requestId"),
 CHECK(jsonb_typeof(state)='object' AND state @> jsonb_build_object('id',id,'paymentId',"paymentId",'requestId',"requestId",'actorId',"actorId")),
 CHECK(state ?& ARRAY['id','paymentId','requestId','actorId','amountMinor','status','digest','created','updated']),
 CHECK(jsonb_typeof(state->'amountMinor')='string' AND state->>'amountMinor' ~ '^[1-9][0-9]{0,9}$' AND (state->>'amountMinor')::bigint BETWEEN 1 AND 9999999999),
 CHECK(jsonb_typeof(state->'status')='string' AND state->>'status' IN ('INITIATING','UNKNOWN','PROCESSING','REFUNDED','CANCELLED'))
);
CREATE INDEX "GatewayRefund_paymentId_idx" ON public."GatewayRefund"("paymentId");
CREATE UNIQUE INDEX "GatewayRefund_provider_reference_unique" ON public."GatewayRefund"((state->>'reference')) WHERE state->>'reference' IS NOT NULL;
CREATE FUNCTION public.gateway_payment_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $payment$
BEGIN
 IF ROW(NEW.id,NEW."bookingId",NEW."userId",NEW."requestId",NEW."tranId") IS DISTINCT FROM ROW(OLD.id,OLD."bookingId",OLD."userId",OLD."requestId",OLD."tranId")
 OR (NEW.state - ARRAY['status','session','valId','bankId','channel','captured','checks','due','lease','updated']) IS DISTINCT FROM (OLD.state - ARRAY['status','session','valId','bankId','channel','captured','checks','due','lease','updated'])
 OR (OLD."valId" IS NOT NULL AND NEW."valId" IS DISTINCT FROM OLD."valId")
 OR (OLD."bankId" IS NOT NULL AND NEW."bankId" IS DISTINCT FROM OLD."bankId")
 OR ((OLD.state->>'captured')::boolean AND NOT (NEW.state->>'captured')::boolean)
 OR (OLD.status IN ('RISK_REVIEW','EXCEPTION_REVIEW') AND NEW.status='VERIFIED')
 THEN RAISE EXCEPTION 'GATEWAY_IMMUTABLE_IDENTITY_OR_CAPTURE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$payment$;
CREATE TRIGGER gateway_payment_immutable BEFORE UPDATE ON public."GatewayPayment" FOR EACH ROW EXECUTE FUNCTION public.gateway_payment_immutable();
CREATE FUNCTION public.gateway_refund_reserve() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $refund$
DECLARE captured jsonb; reserved bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW."paymentId",NEW."requestId",NEW."actorId") IS DISTINCT FROM ROW(OLD.id,OLD."paymentId",OLD."requestId",OLD."actorId")
  OR (NEW.state - ARRAY['status','reference','updated']) IS DISTINCT FROM (OLD.state - ARRAY['status','reference','updated'])
  OR (OLD.state->>'reference' IS NOT NULL AND NEW.state->>'reference' IS DISTINCT FROM OLD.state->>'reference')
  OR (OLD.state->>'status'='REFUNDED' AND NEW.state->>'status'<>'REFUNDED')
  THEN RAISE EXCEPTION 'GATEWAY_REFUND_IMMUTABLE' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT state INTO captured FROM public."GatewayPayment" WHERE id=NEW."paymentId" FOR UPDATE;
 IF captured IS NULL OR captured->>'captured' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'GATEWAY_CAPTURE_REQUIRED' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum((state->>'amountMinor')::bigint),0) INTO reserved FROM public."GatewayRefund" WHERE "paymentId"=NEW."paymentId" AND id<>NEW.id AND state->>'status'<>'CANCELLED';
 IF NEW.state->>'status'<>'CANCELLED' AND reserved+(NEW.state->>'amountMinor')::bigint>(captured->>'amountMinor')::bigint THEN RAISE EXCEPTION 'GATEWAY_REFUND_BALANCE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$refund$;
CREATE TRIGGER gateway_refund_reserve BEFORE INSERT OR UPDATE ON public."GatewayRefund" FOR EACH ROW EXECUTE FUNCTION public.gateway_refund_reserve();
REVOKE ALL ON FUNCTION public.gateway_payment_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gateway_refund_reserve() FROM PUBLIC;
-- No role/ACL changes here. Review exact role/table/column grants separately before local activation.
COMMIT;
