\set ON_ERROR_STOP on
\pset pager off
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $target$ BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'postgres'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'EXACT_CLEANUP_WRONG_LOCAL_TARGET_OR_ADMIN'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 OR EXISTS(SELECT FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) AS expected(migration_name,checksum)
 WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.migration_name AND m.checksum=expected.checksum)) THEN RAISE EXCEPTION 'EXACT_CLEANUP_MIGRATION_MISMATCH'; END IF;
END $target$;
DO $guard$
DECLARE r oid; c record; column_row record; expected_select boolean; expected_insert boolean; expected_update boolean;
BEGIN
 SELECT oid INTO STRICT r FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=12;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=r OR roleid=r)
 OR has_database_privilege(r,current_database(),'CREATE') OR has_database_privilege(r,current_database(),'TEMP')
 OR has_schema_privilege(r,'public','CREATE') THEN RAISE EXCEPTION 'ROLE_RESTRICTIONS_FAILED'; END IF;
 FOR c IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') LOOP
   IF has_table_privilege(r,c.oid,'DELETE') OR has_table_privilege(r,c.oid,'TRUNCATE') OR has_table_privilege(r,c.oid,'TRIGGER') OR has_table_privilege(r,c.oid,'REFERENCES') THEN RAISE EXCEPTION 'DANGEROUS_TABLE_PRIVILEGE'; END IF;
   FOR column_row IN SELECT attname,attnum FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped LOOP
     expected_select := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry')
       OR (c.relname='_prisma_migrations' AND column_row.attname IN ('migration_name','checksum','finished_at','rolled_back_at'));
     expected_insert := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox');
     expected_update := (c.relname='User' AND column_row.attname='name')
       OR (c.relname='Session' AND column_row.attname IN ('revokedAt','lastUsedAt'))
       OR (c.relname='Booking' AND column_row.attname IN ('status','bookingDetails','totalPrice','updatedAt'));
     IF has_column_privilege(r,c.oid,column_row.attnum,'SELECT')<>expected_select
       OR has_column_privilege(r,c.oid,column_row.attnum,'INSERT')<>expected_insert
       OR has_column_privilege(r,c.oid,column_row.attnum,'UPDATE')<>expected_update
       OR has_column_privilege(r,c.oid,column_row.attnum,'REFERENCES') THEN RAISE EXCEPTION 'EXACT_COLUMN_MATRIX_FAILED'; END IF;
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class WHERE relowner=r)
 OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r)
 OR EXISTS(SELECT FROM pg_class acl_relation CROSS JOIN LATERAL aclexplode(acl_relation.relacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_database target_database CROSS JOIN LATERAL aclexplode(target_database.datacl) acl_entry WHERE target_database.datname=current_database() AND acl_entry.grantee=0)
 THEN RAISE EXCEPTION 'OWNERSHIP_GRANT_OPTION_OR_PUBLIC_ACCESS_FAILED'; END IF;
 IF NOT has_column_privilege(r,'public."Booking"','bookingDetails','UPDATE')
 OR has_column_privilege(r,'public."Booking"','userId','UPDATE')
 OR has_column_privilege(r,'public."User"','role','UPDATE')
 OR has_table_privilege(r,'public."ContactMessage"','SELECT') THEN RAISE EXCEPTION 'ACCESS_MATRIX_FAILED'; END IF;
END $guard$;
DO $cleanup$
DECLARE
 notification_ids text[] := ARRAY['cmvxtcxf20008q4f4hr0mqb79','cmvxzb3eb0006ucf4icuoxdcu','cmvxzb3g70008ucf4tpebixcr','cmvz42161000o70f47jyl8myp']::text[];
 history_ids text[] := ARRAY['cmvxtcxee0006q4f43zuw60dt','cmvxzb3930004ucf4kr4rnpqy','cmvxzb3e30005ucf46kldngun','cmvxzb3g30007ucf4vemq7gq0','cmvz4214o000770f4ncd1mw42']::text[];
 passenger_ids text[] := ARRAY['cmvxtcxeb0005q4f4lxyq0c21','cmvz4214k000670f4oaoi8uqb']::text[];
 idempotency_ids text[] := ARRAY['cmvxtcxek0007q4f4yqrnouxi','cmvz42150000d70f48peu4ibz']::text[];
 session_ids text[] := ARRAY['cmvxtcwrn0000q4f4ym1qxcn5','cmvxtcwz00001q4f4pukspax6','cmvxtcx680002q4f4sdhkii3t','cmvxtcxda0003q4f4ktzdgsfs','cmvxzb07h0000ucf4hfq0bxok','cmvxzb0ez0001ucf4gtc5l61h','cmvxzb0m50002ucf47xrprkkq','cmvxzb0t90003ucf4vs8murjr','cmvxzb3rf0009ucf4skt9ngjk','cmvz3ldum000370f44n27ffkl','cmvz492ct001970f4shfd00uw','cmvz4lt3l001a70f45s16qj1z','cmvz4m7ec001b70f44c9rjs15','cmvz4moaw001c70f4ayzyvby5']::text[];
 booking_ids text[] := ARRAY['cmvxtcxe80004q4f4e7e9rceb','cmvz42149000570f405mxse71']::text[];
 user_ids text[] := ARRAY['7a504831-759c-4c1c-8325-4a187f711d91','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','698a9431-d269-4c63-ae57-23e14503d477','76374639-4185-4f99-a451-155c2250503d']::text[];
 user_emails text[] := ARRAY['7a504831-759c-4c1c-8325-4a187f711d91@example.invalid','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6@example.invalid','698a9431-d269-4c63-ae57-23e14503d477@example.invalid','76374639-4185-4f99-a451-155c2250503d@example.invalid']::text[];
 booking_refs text[] := ARRAY['FWS-2026-53YFS3','FWS-2026-5LA6DA']::text[];
 before_catalog text;after_catalog text;before_unowned text;after_unowned text;
 before_counts jsonb := '{}'::jsonb; current_count bigint; affected bigint; target_table record;
 expected_deletes jsonb := '{"NotificationOutbox":4,"BookingStatusHistory":5,"BookingPassenger":2,"IdempotencyRecord":2,"Session":14,"Booking":2,"User":4}'::jsonb;
BEGIN
 LOCK TABLE public."NotificationOutbox",public."BookingStatusHistory",public."BookingPassenger",public."IdempotencyRecord",public."Session",public."Booking",public."User" IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT FROM pg_inherits WHERE inhparent IN('public."User"'::regclass,'public."Session"'::regclass,'public."Booking"'::regclass,'public."BookingPassenger"'::regclass,'public."BookingStatusHistory"'::regclass,'public."IdempotencyRecord"'::regclass,'public."NotificationOutbox"'::regclass) OR inhrelid IN('public."User"'::regclass,'public."Session"'::regclass,'public."Booking"'::regclass,'public."BookingPassenger"'::regclass,'public."BookingStatusHistory"'::regclass,'public."IdempotencyRecord"'::regclass,'public."NotificationOutbox"'::regclass)) THEN RAISE EXCEPTION 'UNREVIEWED_TABLE_INHERITANCE'; END IF;
 PERFORM id FROM public."User" WHERE id=ANY(user_ids) FOR UPDATE;
 PERFORM id FROM public."Booking" WHERE id=ANY(booking_ids) FOR UPDATE;
 IF EXISTS(SELECT FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY(ARRAY['public."NotificationOutbox"'::regclass,'public."BookingStatusHistory"'::regclass,'public."BookingPassenger"'::regclass,'public."IdempotencyRecord"'::regclass,'public."Session"'::regclass,'public."Booking"'::regclass,'public."User"'::regclass])) THEN RAISE EXCEPTION 'UNREVIEWED_DELETE_TRIGGER'; END IF;
 IF EXISTS(SELECT FROM pg_constraint fk WHERE fk.contype='f' AND fk.confrelid IN('public."User"'::regclass,'public."Booking"'::regclass) AND (cardinality(fk.conkey)<>1 OR cardinality(fk.confkey)<>1 OR NOT EXISTS(SELECT FROM pg_attribute att WHERE att.attrelid=fk.confrelid AND att.attnum=fk.confkey[1] AND att.attname='id') OR NOT EXISTS(SELECT FROM pg_class child JOIN pg_attribute att ON att.attrelid=child.oid AND att.attnum=fk.conkey[1] WHERE child.oid=fk.conrelid AND child.relnamespace='public'::regnamespace AND ((fk.confrelid='public."User"'::regclass AND child.relname IN('Account','EmailVerificationToken','PasswordResetToken','Session','Booking','IdempotencyRecord','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry') AND att.attname='userId') OR (fk.confrelid='public."Booking"'::regclass AND child.relname IN('BookingPassenger','BookingStatusHistory') AND att.attname='bookingId'))))) THEN RAISE EXCEPTION 'UNREVIEWED_FOREIGN_KEY'; END IF;
 IF cardinality(notification_ids)<>4 OR (SELECT count(DISTINCT v) FROM unnest(notification_ids)v)<>4 OR (SELECT count(*) FROM public."NotificationOutbox" WHERE id=ANY(notification_ids))<>4 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_NotificationOutbox'; END IF;
 IF cardinality(history_ids)<>5 OR (SELECT count(DISTINCT v) FROM unnest(history_ids)v)<>5 OR (SELECT count(*) FROM public."BookingStatusHistory" WHERE id=ANY(history_ids))<>5 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_BookingStatusHistory'; END IF;
 IF cardinality(passenger_ids)<>2 OR (SELECT count(DISTINCT v) FROM unnest(passenger_ids)v)<>2 OR (SELECT count(*) FROM public."BookingPassenger" WHERE id=ANY(passenger_ids))<>2 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_BookingPassenger'; END IF;
 IF cardinality(idempotency_ids)<>2 OR (SELECT count(DISTINCT v) FROM unnest(idempotency_ids)v)<>2 OR (SELECT count(*) FROM public."IdempotencyRecord" WHERE id=ANY(idempotency_ids))<>2 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_IdempotencyRecord'; END IF;
 IF cardinality(session_ids)<>14 OR (SELECT count(DISTINCT v) FROM unnest(session_ids)v)<>14 OR (SELECT count(*) FROM public."Session" WHERE id=ANY(session_ids))<>14 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_Session'; END IF;
 IF cardinality(booking_ids)<>2 OR (SELECT count(DISTINCT v) FROM unnest(booking_ids)v)<>2 OR (SELECT count(*) FROM public."Booking" WHERE id=ANY(booking_ids))<>2 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_Booking'; END IF;
 IF cardinality(user_ids)<>4 OR (SELECT count(DISTINCT v) FROM unnest(user_ids)v)<>4 OR (SELECT count(*) FROM public."User" WHERE id=ANY(user_ids))<>4 THEN RAISE EXCEPTION 'LEDGER_IDS_MISMATCH_User'; END IF;
 IF NOT EXISTS(SELECT FROM public."User" WHERE id='7a504831-759c-4c1c-8325-4a187f711d91' AND email='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid' AND role::text='CUSTOMER' AND name='Synthetic Phase2' AND "emailVerified" AND length(password)=60 AND left(password,7) IN('$2a$12$','$2b$12$','$2y$12$')) THEN RAISE EXCEPTION 'OWNED_USER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."User" WHERE id='e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6' AND email='e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6@example.invalid' AND role::text='CUSTOMER' AND name='Synthetic Phase2' AND "emailVerified" AND length(password)=60 AND left(password,7) IN('$2a$12$','$2b$12$','$2y$12$')) THEN RAISE EXCEPTION 'OWNED_USER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."User" WHERE id='698a9431-d269-4c63-ae57-23e14503d477' AND email='698a9431-d269-4c63-ae57-23e14503d477@example.invalid' AND role::text='STAFF' AND name='Synthetic Phase2' AND "emailVerified" AND length(password)=60 AND left(password,7) IN('$2a$12$','$2b$12$','$2y$12$')) THEN RAISE EXCEPTION 'OWNED_USER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."User" WHERE id='76374639-4185-4f99-a451-155c2250503d' AND email='76374639-4185-4f99-a451-155c2250503d@example.invalid' AND role::text='ADMIN' AND name='Synthetic Phase2' AND "emailVerified" AND length(password)=60 AND left(password,7) IN('$2a$12$','$2b$12$','$2y$12$')) THEN RAISE EXCEPTION 'OWNED_USER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Booking" WHERE id='cmvxtcxe80004q4f4e7e9rceb' AND "referenceNumber"='FWS-2026-53YFS3' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND "customerEmail"='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid' AND status::text='COMPLETED' AND "totalPrice"=12000 AND currency='BDT' AND "bookingDetails" IS NOT DISTINCT FROM '{"commercial":{"quotes":[{"id":"d2b23d02-adb7-423a-8458-248fadd9b669","amount":11000,"currency":"BDT","createdAt":"2026-11-01T15:22:27.203Z","acceptedAt":null,"validUntil":"2026-11-01T15:22:30.197Z","description":"Synthetic assisted itinerary; no reservation"},{"id":"87b9d786-e51b-4c41-a429-d96de3cf03a7","amount":12500,"currency":"BDT","createdAt":"2026-11-01T15:22:30.238Z","acceptedAt":null,"validUntil":"2026-11-01T15:32:30.232Z","description":"Synthetic assisted itinerary; no reservation"},{"id":"58b4daf8-c952-4f38-8c36-93ae8ae29389","amount":12000,"currency":"BDT","createdAt":"2026-11-01T15:22:30.279Z","acceptedAt":"2026-11-01T15:22:30.323Z","validUntil":"2026-11-01T15:32:30.244Z","description":"Synthetic assisted itinerary; no reservation"}],"version":1,"payments":[{"id":"9716680f-f5a3-41e9-9ee6-3448d02773bc","amount":12000,"method":"BANK_TRANSFER","status":"RECORDED_UNVERIFIED","quoteId":"58b4daf8-c952-4f38-8c36-93ae8ae29389","currency":"BDT","reference":"SYN-CONT-PAY-001","recordedAt":"2026-11-01T15:22:30.437Z"}],"receipts":[{"id":"d2b23d02-adb7-423a-8458-248fadd9b669","actor":"698a9431-d269-4c63-ae57-23e14503d477","command":"sha256:c7e4f10e5540d1c529fbdf82e6517b83505fd9927c764776fdf8b9edaf3f74fb"},{"id":"87b9d786-e51b-4c41-a429-d96de3cf03a7","actor":"698a9431-d269-4c63-ae57-23e14503d477","command":"sha256:c52a6ac0bca3e0678f26d99d6b5928f709494a466722d55902e01ad0a43a1d2d"},{"id":"58b4daf8-c952-4f38-8c36-93ae8ae29389","actor":"698a9431-d269-4c63-ae57-23e14503d477","command":"sha256:64389618a31555e32d8e021e0ac98e4ce95495dd5e669ae0d9b2c9abe6d142a3"},{"id":"9e3da892-2951-4344-becb-a2117f7808fa","actor":"7a504831-759c-4c1c-8325-4a187f711d91","command":"sha256:3d73cc7c80d6d7bf0e8c1c14c2265cee5bb2774a95d1f61a5b5a425cdacc9d79"},{"id":"9716680f-f5a3-41e9-9ee6-3448d02773bc","actor":"698a9431-d269-4c63-ae57-23e14503d477","command":"sha256:b82b5b8befdacc86bc43a37f70482b86d8a6992a9e65ba81593b4d2f9c9b201d"}],"revision":5},"paymentStatus":"AWAITING_PAYMENT_CONFIRMATION"}'::jsonb) THEN RAISE EXCEPTION 'OWNED_BOOKING_STATE_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Booking" WHERE id='cmvz42149000570f405mxse71' AND "referenceNumber"='FWS-2026-5LA6DA' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND "customerEmail"='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid' AND status::text='PENDING' AND "totalPrice"=38940 AND currency='BDT' AND "bookingDetails" IS NOT DISTINCT FROM '{"offerId":"fws-offer-dac-cxb-bg-0","cabinClass":"economy","returnDate":"2026-11-05","flightNumber":"BG 300","departureDate":"2026-11-02"}'::jsonb) THEN RAISE EXCEPTION 'OWNED_BOOKING_STATE_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxtcwrn0000q4f4ym1qxcn5' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxtcwz00001q4f4pukspax6' AND "userId"='e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxtcx680002q4f4sdhkii3t' AND "userId"='698a9431-d269-4c63-ae57-23e14503d477') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxtcxda0003q4f4ktzdgsfs' AND "userId"='76374639-4185-4f99-a451-155c2250503d') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxzb07h0000ucf4hfq0bxok' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxzb0ez0001ucf4gtc5l61h' AND "userId"='e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxzb0m50002ucf47xrprkkq' AND "userId"='698a9431-d269-4c63-ae57-23e14503d477') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxzb0t90003ucf4vs8murjr' AND "userId"='76374639-4185-4f99-a451-155c2250503d') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvxzb3rf0009ucf4skt9ngjk' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvz3ldum000370f44n27ffkl' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvz492ct001970f4shfd00uw' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvz4lt3l001a70f45s16qj1z' AND "userId"='76374639-4185-4f99-a451-155c2250503d') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvz4m7ec001b70f44c9rjs15' AND "userId"='698a9431-d269-4c63-ae57-23e14503d477') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."Session" WHERE id='cmvz4moaw001c70f4ayzyvby5' AND "userId"='e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6') THEN RAISE EXCEPTION 'OWNED_SESSION_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingPassenger" WHERE id='cmvxtcxeb0005q4f4lxyq0c21' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "firstName"='Synthetic' AND "lastName"='Traveller' AND "passportNumber" IS NULL AND "dateOfBirth" IS NULL) THEN RAISE EXCEPTION 'OWNED_PASSENGER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingPassenger" WHERE id='cmvz4214k000670f4oaoi8uqb' AND "bookingId"='cmvz42149000570f405mxse71' AND "firstName"='Synthetic' AND "lastName"='RetryTraveller' AND "passportNumber" IS NULL AND "dateOfBirth" IS NULL) THEN RAISE EXCEPTION 'OWNED_PASSENGER_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id='cmvxtcxee0006q4f43zuw60dt' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "fromStatus"::text='PENDING' AND "toStatus"::text='PENDING') THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id='cmvxzb3930004ucf4kr4rnpqy' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "fromStatus"::text='PENDING' AND "toStatus"::text='PENDING') THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id='cmvxzb3e30005ucf46kldngun' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "fromStatus"::text='PENDING' AND "toStatus"::text='CONFIRMED') THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id='cmvxzb3g30007ucf4vemq7gq0' AND "bookingId"='cmvxtcxe80004q4f4e7e9rceb' AND "fromStatus"::text='CONFIRMED' AND "toStatus"::text='COMPLETED') THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."BookingStatusHistory" WHERE id='cmvz4214o000770f4ncd1mw42' AND "bookingId"='cmvz42149000570f405mxse71' AND "fromStatus"::text='PENDING' AND "toStatus"::text='PENDING') THEN RAISE EXCEPTION 'OWNED_HISTORY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."IdempotencyRecord" WHERE id='cmvxtcxek0007q4f4yqrnouxi' AND "referenceNumber"='FWS-2026-53YFS3' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND operation='booking:create' AND principal='user:7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_IDEMPOTENCY_BINDING_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT FROM public."IdempotencyRecord" WHERE id='cmvz42150000d70f48peu4ibz' AND "referenceNumber"='FWS-2026-5LA6DA' AND "userId"='7a504831-759c-4c1c-8325-4a187f711d91' AND operation='booking:create' AND principal='user:7a504831-759c-4c1c-8325-4a187f711d91') THEN RAISE EXCEPTION 'OWNED_IDEMPOTENCY_BINDING_MISMATCH'; END IF;
 IF (SELECT count(*) FROM public."Session" WHERE "userId"=ANY(user_ids))<>14 OR (SELECT count(*) FROM public."Booking" WHERE "userId"=ANY(user_ids) OR "customerEmail"=ANY(user_emails))<>2 OR (SELECT count(*) FROM public."BookingPassenger" WHERE "bookingId"=ANY(booking_ids))<>2 OR (SELECT count(*) FROM public."BookingStatusHistory" WHERE "bookingId"=ANY(booking_ids))<>5 OR (SELECT count(*) FROM public."IdempotencyRecord" WHERE "userId"=ANY(user_ids) OR "referenceNumber"=ANY(booking_refs))<>2 OR (SELECT count(*) FROM public."NotificationOutbox" WHERE recipient=ANY(user_emails))<>4 THEN RAISE EXCEPTION 'UNEXPECTED_EXTRA_OWNED_RECORDS'; END IF;
 IF EXISTS(SELECT FROM public."NotificationOutbox" WHERE id=ANY(notification_ids) AND (recipient<>ALL(user_emails) OR template NOT IN('BOOKING_CONFIRMATION','BOOKING_STATUS') OR NOT(coalesce(params->>'referenceNumber','')=ANY(booking_refs)) OR status::text='PROCESSING')) THEN RAISE EXCEPTION 'OUTBOX_OWNERSHIP_OR_ACTIVE_CLAIM_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM public."Account" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_Account'; END IF;
 IF EXISTS(SELECT FROM public."EmailVerificationToken" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_EmailVerificationToken'; END IF;
 IF EXISTS(SELECT FROM public."PasswordResetToken" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_PasswordResetToken'; END IF;
 IF EXISTS(SELECT FROM public."FlightInquiry" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_FlightInquiry'; END IF;
 IF EXISTS(SELECT FROM public."HotelInquiry" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_HotelInquiry'; END IF;
 IF EXISTS(SELECT FROM public."PackageInquiry" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_PackageInquiry'; END IF;
 IF EXISTS(SELECT FROM public."VisaInquiry" WHERE "userId"=ANY(user_ids)) THEN RAISE EXCEPTION 'UNREVIEWED_USER_CHILD_VisaInquiry'; END IF;

 SELECT md5(jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(catalog_column) ORDER BY catalog_column.relname,catalog_column.attnum) FROM (SELECT c.relname,c.relkind,c.relowner,c.relacl::text,c.relrowsecurity,a.attnum,a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN('r','p')) catalog_column),
 'constraints',(SELECT jsonb_agg(to_jsonb(catalog_constraint) ORDER BY catalog_constraint.conrelid,catalog_constraint.conname) FROM (SELECT conrelid,conname,contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace) catalog_constraint),
 'indexes',(SELECT jsonb_agg(to_jsonb(catalog_index) ORDER BY catalog_index.indexname) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public') catalog_index),
 'enums',(SELECT jsonb_agg(to_jsonb(catalog_enum) ORDER BY catalog_enum.typname,catalog_enum.enumsortorder) FROM (SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace) catalog_enum),
 'roles',(SELECT jsonb_agg(to_jsonb(role_attribute) ORDER BY role_attribute.rolname) FROM (SELECT oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles) role_attribute),
 'memberships',(SELECT jsonb_agg(to_jsonb(role_member) ORDER BY role_member.roleid,role_member.member) FROM (SELECT roleid,member,grantor,admin_option FROM pg_auth_members) role_member),
 'databases',(SELECT jsonb_agg(to_jsonb(database_access) ORDER BY database_access.datname) FROM (SELECT oid,datname,datdba,datacl::text FROM pg_database) database_access),
 'schema_access',(SELECT jsonb_agg(to_jsonb(schema_access) ORDER BY schema_access.nspname) FROM (SELECT nspname,nspowner,nspacl::text FROM pg_namespace WHERE nspname='public') schema_access)
 )::text) INTO before_catalog;
 SELECT md5(jsonb_build_object(
 'users',(SELECT jsonb_agg(jsonb_build_array(id,role,"emailVerified","createdAt","updatedAt") ORDER BY id) FROM public."User" WHERE NOT(id=ANY(user_ids))),
 'sessions',(SELECT jsonb_agg(jsonb_build_array(id,"userId","expiresAt","revokedAt","lastUsedAt") ORDER BY id) FROM public."Session" WHERE NOT(id=ANY(session_ids))),
 'bookings',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber",status,"totalPrice",currency,"updatedAt") ORDER BY id) FROM public."Booking" WHERE NOT(id=ANY(booking_ids))),
 'passengers',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId") ORDER BY id) FROM public."BookingPassenger" WHERE NOT(id=ANY(passenger_ids))),
 'history',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId","fromStatus","toStatus") ORDER BY id) FROM public."BookingStatusHistory" WHERE NOT(id=ANY(history_ids))),
 'idempotency',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber") ORDER BY id) FROM public."IdempotencyRecord" WHERE NOT(id=ANY(idempotency_ids))),
 'outbox',(SELECT jsonb_agg(jsonb_build_array(id,recipient,status,attempts) ORDER BY id) FROM public."NotificationOutbox" WHERE NOT(id=ANY(notification_ids)))
 )::text) INTO before_unowned;
 FOR target_table IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') ORDER BY relname LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',target_table.relname) INTO current_count;
  before_counts:=before_counts||jsonb_build_object(target_table.relname,current_count);
 END LOOP;
 DELETE FROM public."NotificationOutbox" WHERE id=ANY(notification_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>4 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_NotificationOutbox'; END IF; RAISE NOTICE 'PHASE2_DELETED_NotificationOutbox=%',affected;
 DELETE FROM public."BookingStatusHistory" WHERE id=ANY(history_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>5 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_BookingStatusHistory'; END IF; RAISE NOTICE 'PHASE2_DELETED_BookingStatusHistory=%',affected;
 DELETE FROM public."BookingPassenger" WHERE id=ANY(passenger_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>2 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_BookingPassenger'; END IF; RAISE NOTICE 'PHASE2_DELETED_BookingPassenger=%',affected;
 DELETE FROM public."IdempotencyRecord" WHERE id=ANY(idempotency_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>2 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_IdempotencyRecord'; END IF; RAISE NOTICE 'PHASE2_DELETED_IdempotencyRecord=%',affected;
 DELETE FROM public."Session" WHERE id=ANY(session_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>14 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_Session'; END IF; RAISE NOTICE 'PHASE2_DELETED_Session=%',affected;
 DELETE FROM public."Booking" WHERE id=ANY(booking_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>2 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_Booking'; END IF; RAISE NOTICE 'PHASE2_DELETED_Booking=%',affected;
 DELETE FROM public."User" WHERE id=ANY(user_ids); GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>4 THEN RAISE EXCEPTION 'DELETE_COUNT_MISMATCH_User'; END IF; RAISE NOTICE 'PHASE2_DELETED_User=%',affected;

 SELECT md5(jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(catalog_column) ORDER BY catalog_column.relname,catalog_column.attnum) FROM (SELECT c.relname,c.relkind,c.relowner,c.relacl::text,c.relrowsecurity,a.attnum,a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN('r','p')) catalog_column),
 'constraints',(SELECT jsonb_agg(to_jsonb(catalog_constraint) ORDER BY catalog_constraint.conrelid,catalog_constraint.conname) FROM (SELECT conrelid,conname,contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace) catalog_constraint),
 'indexes',(SELECT jsonb_agg(to_jsonb(catalog_index) ORDER BY catalog_index.indexname) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public') catalog_index),
 'enums',(SELECT jsonb_agg(to_jsonb(catalog_enum) ORDER BY catalog_enum.typname,catalog_enum.enumsortorder) FROM (SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace) catalog_enum),
 'roles',(SELECT jsonb_agg(to_jsonb(role_attribute) ORDER BY role_attribute.rolname) FROM (SELECT oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles) role_attribute),
 'memberships',(SELECT jsonb_agg(to_jsonb(role_member) ORDER BY role_member.roleid,role_member.member) FROM (SELECT roleid,member,grantor,admin_option FROM pg_auth_members) role_member),
 'databases',(SELECT jsonb_agg(to_jsonb(database_access) ORDER BY database_access.datname) FROM (SELECT oid,datname,datdba,datacl::text FROM pg_database) database_access),
 'schema_access',(SELECT jsonb_agg(to_jsonb(schema_access) ORDER BY schema_access.nspname) FROM (SELECT nspname,nspowner,nspacl::text FROM pg_namespace WHERE nspname='public') schema_access)
 )::text) INTO after_catalog;
 SELECT md5(jsonb_build_object(
 'users',(SELECT jsonb_agg(jsonb_build_array(id,role,"emailVerified","createdAt","updatedAt") ORDER BY id) FROM public."User" WHERE NOT(id=ANY(user_ids))),
 'sessions',(SELECT jsonb_agg(jsonb_build_array(id,"userId","expiresAt","revokedAt","lastUsedAt") ORDER BY id) FROM public."Session" WHERE NOT(id=ANY(session_ids))),
 'bookings',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber",status,"totalPrice",currency,"updatedAt") ORDER BY id) FROM public."Booking" WHERE NOT(id=ANY(booking_ids))),
 'passengers',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId") ORDER BY id) FROM public."BookingPassenger" WHERE NOT(id=ANY(passenger_ids))),
 'history',(SELECT jsonb_agg(jsonb_build_array(id,"bookingId","fromStatus","toStatus") ORDER BY id) FROM public."BookingStatusHistory" WHERE NOT(id=ANY(history_ids))),
 'idempotency',(SELECT jsonb_agg(jsonb_build_array(id,"userId","referenceNumber") ORDER BY id) FROM public."IdempotencyRecord" WHERE NOT(id=ANY(idempotency_ids))),
 'outbox',(SELECT jsonb_agg(jsonb_build_array(id,recipient,status,attempts) ORDER BY id) FROM public."NotificationOutbox" WHERE NOT(id=ANY(notification_ids)))
 )::text) INTO after_unowned;
 IF before_catalog IS DISTINCT FROM after_catalog OR before_unowned IS DISTINCT FROM after_unowned THEN RAISE EXCEPTION 'CATALOG_ACCESS_OR_UNOWNED_PRESERVATION_FAILED'; END IF;
 FOR target_table IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') ORDER BY relname LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',target_table.relname) INTO current_count;
  IF current_count IS DISTINCT FROM ((before_counts->>target_table.relname)::bigint-coalesce((expected_deletes->>target_table.relname)::bigint,0)) THEN RAISE EXCEPTION 'UNEXPECTED_TABLE_COUNT_DELTA'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM public."User" WHERE id=ANY(user_ids)) OR EXISTS(SELECT FROM public."Session" WHERE "userId"=ANY(user_ids)) OR EXISTS(SELECT FROM public."Booking" WHERE id=ANY(booking_ids) OR "userId"=ANY(user_ids) OR "customerEmail"=ANY(user_emails)) OR EXISTS(SELECT FROM public."NotificationOutbox" WHERE recipient=ANY(user_emails)) OR EXISTS(SELECT FROM public."IdempotencyRecord" WHERE "userId"=ANY(user_ids) OR "referenceNumber"=ANY(booking_refs)) THEN RAISE EXCEPTION 'OWNED_GRAPH_NOT_EMPTY'; END IF;
END $cleanup$;
DO $guard$
DECLARE r oid; c record; column_row record; expected_select boolean; expected_insert boolean; expected_update boolean;
BEGIN
 SELECT oid INTO STRICT r FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=12;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=r OR roleid=r)
 OR has_database_privilege(r,current_database(),'CREATE') OR has_database_privilege(r,current_database(),'TEMP')
 OR has_schema_privilege(r,'public','CREATE') THEN RAISE EXCEPTION 'ROLE_RESTRICTIONS_FAILED'; END IF;
 FOR c IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') LOOP
   IF has_table_privilege(r,c.oid,'DELETE') OR has_table_privilege(r,c.oid,'TRUNCATE') OR has_table_privilege(r,c.oid,'TRIGGER') OR has_table_privilege(r,c.oid,'REFERENCES') THEN RAISE EXCEPTION 'DANGEROUS_TABLE_PRIVILEGE'; END IF;
   FOR column_row IN SELECT attname,attnum FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped LOOP
     expected_select := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry')
       OR (c.relname='_prisma_migrations' AND column_row.attname IN ('migration_name','checksum','finished_at','rolled_back_at'));
     expected_insert := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox');
     expected_update := (c.relname='User' AND column_row.attname='name')
       OR (c.relname='Session' AND column_row.attname IN ('revokedAt','lastUsedAt'))
       OR (c.relname='Booking' AND column_row.attname IN ('status','bookingDetails','totalPrice','updatedAt'));
     IF has_column_privilege(r,c.oid,column_row.attnum,'SELECT')<>expected_select
       OR has_column_privilege(r,c.oid,column_row.attnum,'INSERT')<>expected_insert
       OR has_column_privilege(r,c.oid,column_row.attnum,'UPDATE')<>expected_update
       OR has_column_privilege(r,c.oid,column_row.attnum,'REFERENCES') THEN RAISE EXCEPTION 'EXACT_COLUMN_MATRIX_FAILED'; END IF;
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class WHERE relowner=r)
 OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r)
 OR EXISTS(SELECT FROM pg_class acl_relation CROSS JOIN LATERAL aclexplode(acl_relation.relacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_database target_database CROSS JOIN LATERAL aclexplode(target_database.datacl) acl_entry WHERE target_database.datname=current_database() AND acl_entry.grantee=0)
 THEN RAISE EXCEPTION 'OWNERSHIP_GRANT_OPTION_OR_PUBLIC_ACCESS_FAILED'; END IF;
 IF NOT has_column_privilege(r,'public."Booking"','bookingDetails','UPDATE')
 OR has_column_privilege(r,'public."Booking"','userId','UPDATE')
 OR has_column_privilege(r,'public."User"','role','UPDATE')
 OR has_table_privilege(r,'public."ContactMessage"','SELECT') THEN RAISE EXCEPTION 'ACCESS_MATRIX_FAILED'; END IF;
END $guard$;
COMMIT;
\echo PHASE2_EXACT_OWNED_CLEANUP_COMMITTED_33_ROWS
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
DO $target$ BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'postgres'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 5432
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'EXACT_CLEANUP_WRONG_LOCAL_TARGET_OR_ADMIN'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations)<>7 OR EXISTS(SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
 OR EXISTS(SELECT FROM (VALUES ('20260926202822_init','efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb'),('20260927082715_full_schema','ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921'),('20261009000000_auth_sessions_and_password_resets','e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4'),('20261011000000_inquiry_idempotency','0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706'),('20261011120000_notification_outbox','1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2'),('20261022000100_contact_status_new','4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'),('20261022000200_booking_contact_schema','bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b')) AS expected(migration_name,checksum)
 WHERE NOT EXISTS(SELECT FROM public._prisma_migrations m WHERE m.migration_name=expected.migration_name AND m.checksum=expected.checksum)) THEN RAISE EXCEPTION 'EXACT_CLEANUP_MIGRATION_MISMATCH'; END IF;
END $target$;
DO $guard$
DECLARE r oid; c record; column_row record; expected_select boolean; expected_insert boolean; expected_update boolean;
BEGIN
 SELECT oid INTO STRICT r FROM pg_roles WHERE rolname='flywithsafe_phase2_booking_test' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=12;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=r OR roleid=r)
 OR has_database_privilege(r,current_database(),'CREATE') OR has_database_privilege(r,current_database(),'TEMP')
 OR has_schema_privilege(r,'public','CREATE') THEN RAISE EXCEPTION 'ROLE_RESTRICTIONS_FAILED'; END IF;
 FOR c IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p') LOOP
   IF has_table_privilege(r,c.oid,'DELETE') OR has_table_privilege(r,c.oid,'TRUNCATE') OR has_table_privilege(r,c.oid,'TRIGGER') OR has_table_privilege(r,c.oid,'REFERENCES') THEN RAISE EXCEPTION 'DANGEROUS_TABLE_PRIVILEGE'; END IF;
   FOR column_row IN SELECT attname,attnum FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped LOOP
     expected_select := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry')
       OR (c.relname='_prisma_migrations' AND column_row.attname IN ('migration_name','checksum','finished_at','rolled_back_at'));
     expected_insert := c.relname IN ('User','Session','Booking','BookingPassenger','BookingStatusHistory','IdempotencyRecord','NotificationOutbox');
     expected_update := (c.relname='User' AND column_row.attname='name')
       OR (c.relname='Session' AND column_row.attname IN ('revokedAt','lastUsedAt'))
       OR (c.relname='Booking' AND column_row.attname IN ('status','bookingDetails','totalPrice','updatedAt'));
     IF has_column_privilege(r,c.oid,column_row.attnum,'SELECT')<>expected_select
       OR has_column_privilege(r,c.oid,column_row.attnum,'INSERT')<>expected_insert
       OR has_column_privilege(r,c.oid,column_row.attnum,'UPDATE')<>expected_update
       OR has_column_privilege(r,c.oid,column_row.attnum,'REFERENCES') THEN RAISE EXCEPTION 'EXACT_COLUMN_MATRIX_FAILED'; END IF;
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class WHERE relowner=r)
 OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r)
 OR EXISTS(SELECT FROM pg_class acl_relation CROSS JOIN LATERAL aclexplode(acl_relation.relacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) acl_entry WHERE acl_entry.grantee=r AND acl_entry.is_grantable)
 OR EXISTS(SELECT FROM pg_database target_database CROSS JOIN LATERAL aclexplode(target_database.datacl) acl_entry WHERE target_database.datname=current_database() AND acl_entry.grantee=0)
 THEN RAISE EXCEPTION 'OWNERSHIP_GRANT_OPTION_OR_PUBLIC_ACCESS_FAILED'; END IF;
 IF NOT has_column_privilege(r,'public."Booking"','bookingDetails','UPDATE')
 OR has_column_privilege(r,'public."Booking"','userId','UPDATE')
 OR has_column_privilege(r,'public."User"','role','UPDATE')
 OR has_table_privilege(r,'public."ContactMessage"','SELECT') THEN RAISE EXCEPTION 'ACCESS_MATRIX_FAILED'; END IF;
END $guard$;
DO $final$ BEGIN
 IF EXISTS(SELECT FROM public."User" WHERE id=ANY(ARRAY['7a504831-759c-4c1c-8325-4a187f711d91','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','698a9431-d269-4c63-ae57-23e14503d477','76374639-4185-4f99-a451-155c2250503d']::text[])) OR EXISTS(SELECT FROM public."Booking" WHERE id=ANY(ARRAY['cmvxtcxe80004q4f4e7e9rceb','cmvz42149000570f405mxse71']::text[])) OR EXISTS(SELECT FROM public."Session" WHERE "userId"=ANY(ARRAY['7a504831-759c-4c1c-8325-4a187f711d91','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6','698a9431-d269-4c63-ae57-23e14503d477','76374639-4185-4f99-a451-155c2250503d']::text[])) OR EXISTS(SELECT FROM public."NotificationOutbox" WHERE recipient=ANY(ARRAY['7a504831-759c-4c1c-8325-4a187f711d91@example.invalid','e3061e7a-ac46-4ed5-b3f3-fbc8b52feac6@example.invalid','698a9431-d269-4c63-ae57-23e14503d477@example.invalid','76374639-4185-4f99-a451-155c2250503d@example.invalid']::text[])) OR EXISTS(SELECT FROM public."IdempotencyRecord" WHERE "referenceNumber"=ANY(ARRAY['FWS-2026-53YFS3','FWS-2026-5LA6DA']::text[])) THEN RAISE EXCEPTION 'FINAL_OWNED_STATE_NOT_EMPTY'; END IF;
END $final$;
SELECT (SELECT count(*) FROM public."User") AS preserved_unlisted_users, (SELECT count(*) FROM public."Session") AS preserved_unlisted_sessions, (SELECT count(*) FROM public."Booking") AS remaining_unlisted_bookings, (SELECT count(*) FROM public."NotificationOutbox") AS remaining_unlisted_notifications;
ROLLBACK;
\echo PHASE2_CLEANUP_CATALOG_ACCESS_AND_FINAL_READONLY_PASS
