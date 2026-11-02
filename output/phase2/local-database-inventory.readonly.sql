\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT current_database() AS database,current_user AS role,inet_server_addr(),inet_server_port(),current_setting('server_version') AS version,current_setting('transaction_read_only') AS read_only;
SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname;
SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name;
SELECT c.relname AS table_name,a.attname AS column_name,t.typname AS type,a.attnotnull AS not_null FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT (SELECT count(*) FROM public."User") AS users,(SELECT count(*) FROM public."Booking") AS bookings,(SELECT count(*) FROM public."Session") AS sessions;
ROLLBACK;
