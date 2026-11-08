BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';
SELECT json_build_object(
  'diagnosticOnly', true,
  'database', current_database(),
  'role', current_user::text,
  'sessionRole', session_user::text,
  'addressAsV05Text', inet_server_addr()::text,
  'addressAsHost', host(inet_server_addr()),
  'port', inet_server_port(),
  'maintenanceDatabaseOid', (SELECT oid::int FROM pg_catalog.pg_database WHERE datname = current_database()),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'databaseMatches', current_database() = 'postgres',
  'roleMatches', current_user::text = 'postgres',
  'sessionRoleMatches', session_user::text = 'postgres',
  'v05AddressMatches', inet_server_addr()::text = '127.0.0.1',
  'hostAddressMatches', host(inet_server_addr()) = '127.0.0.1',
  'portMatches', inet_server_port() = 5432
);
ROLLBACK;
