import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { expect, it } from 'vitest';
import { verifyMigrationHistory } from './migration-history.mjs';

const rows = () => readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => ({
  migration_name: e.name, finished_at: new Date(), rolled_back_at: null,
  checksum: createHash('sha256').update(readFileSync(`prisma/migrations/${e.name}/migration.sql`, 'utf8').replace(/\r\n/g, '\n')).digest('hex'),
}));
it('accepts matching history with normalized LF checksums', () => {
  expect(verifyMigrationHistory(rows())).toHaveLength(7);
});
it('rejects the five-migration baseline until both prepared migrations are applied', () => {
  expect(() => verifyMigrationHistory(rows().filter(r => !r.migration_name.startsWith('20261022')))).toThrow('missing');
});
it('rejects unknown applied history', () => {
  const list = rows(); list.push({ ...list[0], migration_name: 'unknown' });
  expect(() => verifyMigrationHistory(list)).toThrow('Unknown');
});
it('rejects modified migration checksums', () => {
  const list = rows(); list[0].checksum = '0'.repeat(64);
  expect(() => verifyMigrationHistory(list)).toThrow('checksum');
});
it('rejects unresolved failed history', () => {
  const list: any[] = rows(); list[0].finished_at = null;
  expect(() => verifyMigrationHistory(list)).toThrow('failed');
});
it('rejects duplicate completed records', () => {
  const list = rows(); list.push(list[0]); expect(() => verifyMigrationHistory(list)).toThrow('duplicated');
});
it('does not count rolled-back attempts as completed migrations', () => {
  const list: any[] = rows(); list[0].rolled_back_at = new Date();
  expect(() => verifyMigrationHistory(list)).toThrow('missing');
});
