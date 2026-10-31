-- NOT EXECUTED. Separate owner approval required for these exact synthetic mutations.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
DO $$
BEGIN
  IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres' OR session_user<>'postgres'
    OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port()<>5432
    OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
    OR EXISTS(SELECT 1 FROM public."User") THEN RAISE EXCEPTION 'PHASE1_PROBE_TARGET_FAILED'; END IF;
END $$;
DO $$
DECLARE caught boolean; env jsonb:='{"version":1,"keyRef":"synthetic-only","nonce":"AAAAAAAAAAAAAAAA","ciphertext":"YQ","tag":"AAAAAAAAAAAAAAAAAAAAAA"}';
BEGIN
  INSERT INTO public."User" (id,email,"updatedAt") VALUES ('phase1_probe_user','synthetic-schema@example.invalid',clock_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO public."ProtectedCredential" (id,"userId",generation,purpose,digest,"expiresAt","jobId")
    VALUES ('phase1_probe_credential','phase1_probe_user',0,'reset',repeat('a',64),clock_timestamp()+interval '1 hour','phase1_probe_job');
  INSERT INTO public."ProtectedAuthJob" (id,"credentialId",envelope) VALUES ('phase1_probe_job','phase1_probe_credential',env);
  SET CONSTRAINTS ALL IMMEDIATE;
  caught:=false;
  BEGIN
    INSERT INTO public."ProtectedCredential" (id,"userId",generation,purpose,digest,"expiresAt","jobId")
      VALUES ('phase1_probe_duplicate','phase1_probe_user',0,'reset',repeat('b',64),clock_timestamp()+interval '1 hour','phase1_probe_duplicate_job');
  EXCEPTION WHEN unique_violation THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'LIVE_PURPOSE_UNIQUENESS_FAILED'; END IF;
  caught:=false;
  BEGIN
    INSERT INTO public."AuthIssuanceRequest" ("keyHash",fingerprint,state) VALUES(repeat('b',64),'h1:synthetic:'||repeat('c',64),'RESERVED');
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='ISSUANCE_REQUEST_INCOMPLETE' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'DEFERRED_RECEIPT_COMPLETION_FAILED'; END IF;
  caught:=false;
  BEGIN
    INSERT INTO public."ProtectedCredential" (id,"userId",generation,purpose,digest,"expiresAt","jobId")
      VALUES ('phase1_probe_orphan','phase1_probe_user',0,'verification',repeat('d',64),clock_timestamp()+interval '1 hour','phase1_probe_absent_job');
  EXCEPTION WHEN foreign_key_violation THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'CREDENTIAL_JOB_FK_FAILED'; END IF;
  caught:=false;
  BEGIN
    INSERT INTO public."AuthIssuanceRequest" ("keyHash",fingerprint,state,"completedAt",receipt,"userId","credentialId","jobId")
      VALUES(repeat('e',64),'h1:synthetic:'||repeat('f',64),'COMMITTED',clock_timestamp(),
        jsonb_build_object('operation','reset','userId','phase1_probe_other_user','credentialId','phase1_probe_credential','jobId','phase1_probe_job','sessionId',NULL),
        'phase1_probe_other_user','phase1_probe_credential','phase1_probe_job');
  EXCEPTION WHEN foreign_key_violation THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'RECEIPT_SUBJECT_FK_FAILED'; END IF;
  INSERT INTO public."AuthIssuanceRequest" ("keyHash",fingerprint,state,"completedAt",receipt,"userId","credentialId","jobId")
    VALUES(repeat('1',64),'h1:synthetic:'||repeat('2',64),'COMMITTED',clock_timestamp(),
      jsonb_build_object('operation','reset','userId','phase1_probe_user','credentialId','phase1_probe_credential','jobId','phase1_probe_job','sessionId',NULL),
      'phase1_probe_user','phase1_probe_credential','phase1_probe_job');
  caught:=false;
  BEGIN UPDATE public."AuthIssuanceRequest" SET fingerprint='h1:synthetic:'||repeat('3',64) WHERE "keyHash"=repeat('1',64);
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='ISSUANCE_REQUEST_IMMUTABLE' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'RECEIPT_IMMUTABILITY_FAILED'; END IF;
  UPDATE public."AuthSecurityState" SET "legacyRetiredAt"=clock_timestamp() WHERE "userId"='phase1_probe_user';
  caught:=false;
  BEGIN UPDATE public."AuthSecurityState" SET "legacyRetiredAt"=NULL WHERE "userId"='phase1_probe_user';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='PROTECTED_ENROLLMENT_REGRESSION' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'ENROLLMENT_MONOTONICITY_FAILED'; END IF;
  UPDATE public."ProtectedAuthJob" SET state='LEASED',version=1,"workerId"='synthetic-worker',"leaseUntil"=clock_timestamp()+interval '1 minute' WHERE id='phase1_probe_job';
  UPDATE public."ProtectedAuthJob" SET state='SENDING' WHERE id='phase1_probe_job';
  UPDATE public."ProtectedAuthJob" SET state='AMBIGUOUS' WHERE id='phase1_probe_job';
  caught:=false;
  BEGIN UPDATE public."ProtectedAuthJob" SET state='LEASED',version=2 WHERE id='phase1_probe_job';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='PROTECTED_JOB_FENCE_INVALID' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'TERMINAL_JOB_FENCING_FAILED'; END IF;
  INSERT INTO public."Booking" (id,"referenceNumber","customerName","customerEmail","updatedAt") VALUES
    ('phase1_probe_booking','PHASE1-SYNTHETIC','Synthetic','synthetic-schema@example.invalid',clock_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO public."BookingPassenger" (id,"bookingId","firstName","lastName") VALUES('phase1_probe_passenger','phase1_probe_booking','Synthetic','Only');
  INSERT INTO public."PassengerSecret" ("passengerId","bookingId",revision,envelope) VALUES('phase1_probe_passenger','phase1_probe_booking',1,env);
  caught:=false;
  BEGIN UPDATE public."PassengerSecret" SET revision=3 WHERE "passengerId"='phase1_probe_passenger';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='PASSENGER_REVISION_INVALID' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'PASSENGER_CAS_FENCING_FAILED'; END IF;
  INSERT INTO public."Booking" (id,"referenceNumber","customerName","customerEmail","updatedAt") VALUES
    ('phase1_probe_other_booking','PHASE1-SYNTHETIC-OTHER','Synthetic','synthetic-schema@example.invalid',clock_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO public."BookingPassenger" (id,"bookingId","firstName","lastName") VALUES('phase1_probe_other_passenger','phase1_probe_booking','Synthetic','Other');
  caught:=false;
  BEGIN INSERT INTO public."PassengerSecret" ("passengerId","bookingId",revision,envelope)
    VALUES('phase1_probe_other_passenger','phase1_probe_other_booking',1,env);
  EXCEPTION WHEN foreign_key_violation THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'PASSENGER_OWNERSHIP_FK_FAILED'; END IF;
  INSERT INTO public."NotificationOutbox" (id,recipient,subject,payload,"updatedAt")
    VALUES('phase1_probe_notification','synthetic-schema@example.invalid','Synthetic only','{}'::jsonb,clock_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO public."NotificationSendIntent" ("recordId",version,state)
    VALUES('phase1_probe_notification',timestamp '2026-10-29 00:00:00','SENDING');
  UPDATE public."NotificationSendIntent" SET state='AMBIGUOUS' WHERE "recordId"='phase1_probe_notification';
  caught:=false;
  BEGIN UPDATE public."NotificationSendIntent" SET state='SENDING' WHERE "recordId"='phase1_probe_notification';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='NOTIFICATION_SEND_INTENT_IMMUTABLE' THEN caught:=true; ELSE RAISE; END IF; END;
  IF NOT caught THEN RAISE EXCEPTION 'ORDINARY_INTENT_IMMUTABILITY_FAILED'; END IF;
END $$;
SELECT 'PHASE1_ROLLBACK_CONSTRAINT_PROBE_PASS' AS result;
ROLLBACK;
-- Caller must run the reviewed read-only clean-state postcheck even after probe failure.
