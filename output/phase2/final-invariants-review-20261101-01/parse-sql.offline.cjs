const fs = require('node:fs'), path = require('node:path');
const parser = require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'verify-final.readonly.sql'), 'utf8');
  if (!sql.startsWith('\\set ON_ERROR_STOP on') || (sql.match(/^\\gset$/gm) || []).length !== 1 || !sql.includes('\\if :all_matched')) throw new Error('PSQL_META_INVALID');
  const clean = sql.replace(/^\s*\\gset.*$/gm, ';').replace(/^\s*\\.*$/gm, '');
  const parsed = await parser.parse(clean);
  let blocks = 0;
  for (const match of sql.matchAll(/\bDO\s+(\$[A-Za-z_][A-Za-z0-9_]*\$)([\s\S]*?)\1\s*;/g)) {
    await parser.parsePlPgSQL(`CREATE FUNCTION __offline_only__() RETURNS void AS ${match[1]}${match[2]}${match[1]} LANGUAGE plpgsql;`);
    blocks++;
  }
  const result = { passed: true, parser: 'existing PostgreSQL18 WASM libpg-query', statements: parsed.stmts.length, plpgsqlBlocks: blocks, databaseExecuted: false };
  fs.writeFileSync(path.join(__dirname, 'sql-parser-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(() => { console.error('OFFLINE_SQL_PARSER_STOP'); process.exitCode = 1; });
