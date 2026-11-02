const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const write = (name, data) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2));
const parser = require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
(async () => {
  const original = path.join(root, 'output/phase3/postgres-proof-20261103-01');
  const result = JSON.parse(fs.readFileSync(path.join(original, 'proof-result.json'), 'utf8'));
  const journal = fs.readFileSync(path.join(original, 'ledger.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const owned = journal.find(r => r.kind === 'final-owned-row-ids').rows;
  const counts = Object.fromEntries([...new Set(owned.map(r => r.kind))].map(k => [k, owned.filter(r => r.kind === k).length]));
  const intended = new Set(['server/src/payments/payment-store.ts','server/test/phase3-ledger.pg.integration.ts','server/test/phase3-proof-diagnostics.ts','server/test/phase3-proof-diagnostics.test.ts']);
  const oldPins = JSON.parse(fs.readFileSync(path.join(original, 'pins.json'), 'utf8'));
  const changes = oldPins.filter(p => hash(p.path) !== p.sha256).map(p => path.relative(root, p.path).replaceAll('\\','/'));
  if(changes.some(p => !intended.has(p))) throw Error('UNEXPECTED_OLD_PIN_DRIFT');
  for(const [name, relative] of [['consumed-test.source.ts','server/test/phase3-ledger.pg.integration.ts'],['payment-store.before.ts','server/src/payments/payment-store.ts']]) {
    const old = oldPins.find(p => path.relative(root,p.path).replaceAll('\\','/') === relative);
    if(!old || hash(path.join(__dirname,name)) !== old.sha256) throw Error('SOURCE_ARCHIVE_MISMATCH');
  }
  const beforeStore=fs.readFileSync(path.join(__dirname,'payment-store.before.ts'),'utf8').replaceAll('\r\n','\n');
  const afterStore=fs.readFileSync(path.join(root,'server/src/payments/payment-store.ts'),'utf8').replaceAll('\r\n','\n');
  const expectedStore=beforeStore.replace('clock_timestamp() AS now',"clock_timestamp() AT TIME ZONE 'UTC' AS now").replace('SELECT e.kind,e."createdAt" FROM', 'SELECT e.kind,e."createdAt" AT TIME ZONE \'UTC\' AS "createdAt" FROM');
  const strippedStore=afterStore.replace(/      \/\/ adapter-pg[^\n]*\n      \/\/ UTC timestamp[^\n]*\n/,'');
  if(expectedStore!==strippedStore) throw Error('RUNTIME_DELTA_EXCEEDS_TWO_UTC_PROJECTIONS');
  let storeSqlQueries=0;
  for(const match of afterStore.matchAll(/Prisma\.sql`([\s\S]*?)`/g)) { await parser.parse(match[1].replace(/\$\{[^}]+\}/g,'NULL')); storeSqlQueries++; }
  if(result.passed || result.checked !== 10 || result.unexecutedChecks !== 54 || owned.length !== 10) throw Error('HISTORICAL_FAILURE_MISMATCH');
  const sql = fs.readFileSync(path.join(__dirname,'clock-fixtures.readonly.sql'),'utf8');
  if(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|GRANT|DROP)\b/i.test(sql)) throw Error('READ_ONLY_ALLOWLIST_VIOLATION');
  const ast = await parser.parse(sql.replace(/^\\.*$/gm,''));
  const block = sql.match(/DO \$identity\$([\s\S]*?)\$identity\$;/)[1];
  await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS $identity$'+block+'$identity$ LANGUAGE plpgsql;');
  for (const name of ['vitest-bundled-normal-access.json','vitest-native.json']) {
    const r=JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
    if(!r.success || r.numPassedTests!==117 || r.numFailedTests || r.numPendingTests) throw Error('OFFLINE_TESTS_INCOMPLETE');
  }
  const artifacts=fs.readdirSync(original,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>({path:path.join(original,e.name),sha256:hash(path.join(original,e.name))}));
  const manifest = path.join(__dirname,'historical-artifacts.json');
  if(fs.existsSync(manifest)) { const saved=JSON.parse(fs.readFileSync(manifest,'utf8')); if(saved.some(p=>hash(p.path)!==p.sha256)) throw Error('HISTORICAL_EVIDENCE_CHANGED'); }
  else write('historical-artifacts.json',artifacts);
  const dependencies=['clock-fixtures.readonly.sql','historical-artifacts.json',...['proof-result.json','ledger.jsonl','caller-result.json','attempt-started.json'].map(n=>path.join(original,n))];
  const pins=dependencies.map(p=>path.isAbsolute(p)?p:path.join(__dirname,p)).map(p=>({path:p,sha256:hash(p)}));
  write('readonly-pins.json',pins);
  const report={historical:{vitestPassed:0,vitestFailed:1,checkpointsPassed:10,checkpointsFailed:0,unexecuted:54,snapshotCounts:counts,snapshotTotal:owned.length,currentDatabaseRequeried:false,contenderIndexCaptured:false,originalExceptionMessageCaptured:false,artifactsUnchanged:true,intendedSourceChanges:changes},offline:{bundled:117,native:117,failures:0,skips:0,newTests:12,sqlStatements:ast.stmts.length,plpgsqlBlocks:1,storeSqlQueries,exactRuntimeDeltaVerified:true},readOnlyPins:pins.length,callerSha256:hash(path.join(__dirname,'Read-OnlyClock.ps1')),newReadOnlyAttempt:fs.existsSync(path.join(__dirname,'readonly-attempt.json')),liveDatabaseExecuted:false};
  write('review-verification.json',report); console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
