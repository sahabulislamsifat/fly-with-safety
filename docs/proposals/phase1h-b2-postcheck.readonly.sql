-- Run only after separately approved initialization of the exact fresh local target.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database, current_user AS role,
       host(inet_server_addr()) AS host, inet_server_port() AS port,
       current_setting('transaction_read_only') AS read_only;
-- Includes only the previously reviewed catalog SELECT; paths are relative to this file.
\ir ../../server/test/integration-schema-preflight.sql
SELECT migration_name, checksum, finished_at IS NOT NULL AS completed,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public._prisma_migrations ORDER BY started_at;
SELECT count(*) AS public_tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes
WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT c.relname AS table_name,k.conname,k.convalidated,pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname,k.conname;
SELECT column_name,data_type,udt_name,is_nullable,column_default,datetime_precision
FROM information_schema.columns WHERE table_schema='public' AND table_name='NotificationOutbox'
ORDER BY ordinal_position;
SELECT (SELECT count(*) FROM public."User") AS users,
       (SELECT count(*) FROM public."Booking") AS bookings,
       (SELECT count(*) FROM public."IdempotencyRecord") AS idempotency_records,
       (SELECT count(*) FROM public."NotificationOutbox") AS notifications;
COMMIT;
