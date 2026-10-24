import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** Pure history/file verification. Never connects, changes history, or applies SQL. */
export function verifyMigrationHistory(rows, directory = 'prisma/migrations') {
  const names = readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  if (rows.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Unresolved failed migration');
  const completed = rows.filter(row => row.finished_at && !row.rolled_back_at);
  if (completed.some(row => !names.includes(row.migration_name))) throw new Error('Unknown applied migration');
  for (const name of names) {
    const matches = completed.filter(row => row.migration_name === name);
    if (matches.length !== 1) throw new Error('Required migration missing or duplicated');
    const sql = readFileSync(resolve(directory, name, 'migration.sql'), 'utf8');
    const hashes = [sql, sql.replace(/\r\n/g, '\n'), sql.replace(/\r?\n/g, '\r\n')]
      .map(value => createHash('sha256').update(value).digest('hex'));
    if (!hashes.includes(matches[0].checksum)) throw new Error('Migration checksum conflict');
  }
  return names;
}
