const fs = require('node:fs');
const path = require('node:path');
const parser = require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
const root = path.resolve(__dirname, '../../..');
(async () => {
  const sql = fs.readFileSync(path.join(root, 'server/prisma/migrations/20261103000100_gateway_sandbox_ledgers/migration.sql'), 'utf8');
  const ast = await parser.parse(sql); let functions = 0;
  for (const m of sql.matchAll(/CREATE FUNCTION[\s\S]*?\$(payment|refund)\$;/g)) { await parser.parsePlPgSQL(m[0]); functions++; }
  if (functions !== 2) throw Error('EXPECTED_TWO_TRIGGER_FUNCTIONS');
  const access = fs.readFileSync(path.join(__dirname,'restricted-access.review.sql'),'utf8');
  const accessAst = await parser.parse(access);
  const block = access.match(/DO\s+(\$identity\$)([\s\S]*?)\1;/);
  if (!block) throw Error('ACCESS_IDENTITY_GUARD_MISSING');
  await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS $identity$'+block[2]+'$identity$ LANGUAGE plpgsql;');
  const result = { passed: true, statements: ast.stmts.length, functions, accessStatements: accessAst.stmts.length, accessGuards: 1, databaseExecuted: false, parser: 'PostgreSQL18 WASM' };
  fs.writeFileSync(path.join(__dirname, 'sql-parser.json'), JSON.stringify(result, null, 2)); console.log(result);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
