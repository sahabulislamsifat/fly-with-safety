-- Catalog inspection only. Run against 127.0.0.1:5432/flywithsafe_integration.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database, inet_server_addr() AS host,
       inet_server_port() AS port, current_setting('transaction_read_only') AS read_only;
SELECT n.nspname AS schema, c.relname AS table_name,
       c.reltuples::bigint AS estimated_rows
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2;
-- Negative estimates mean statistics are unavailable, not an empty table.
SELECT migration_name, checksum, finished_at IS NOT NULL AS completed,
       rolled_back_at IS NOT NULL AS rolled_back
FROM "_prisma_migrations" ORDER BY migration_name;
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
       datetime_precision
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('Booking','BookingPassenger','BookingStatusHistory','ContactMessage','NotificationOutbox')
ORDER BY table_name, ordinal_position;
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT c.relname AS table_name, k.conname, pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname,k.conname;
SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' ORDER BY tablename,indexname;
COMMIT;
