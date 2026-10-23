-- Prepared for review; applying this migration requires separate local-database approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Must commit before NEW is used as a default in the second migration.
ALTER TYPE public."ContactStatus" ADD VALUE 'NEW';

COMMIT;
