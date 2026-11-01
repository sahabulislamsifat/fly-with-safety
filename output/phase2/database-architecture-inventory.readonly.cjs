const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../server/package.json'));
const { Client } = local('pg');
const env = local('dotenv').parse(fs.readFileSync('server/.env'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const expected = fs.readdirSync('server/prisma/migrations', { withFileTypes:true }).filter(x=>x.isDirectory()).map(x=>({name:x.name,checksum:hash(fs.readFileSync(path.join('server/prisma/migrations',x.name,'migration.sql')))}));
async function inspect(label, connectionString) {
  if(!connectionString) return {label,unavailable:true};
  const client=new Client({connectionString,connectionTimeoutMillis:8000,query_timeout:8000});
  client.on('error',()=>{});
  const result={label,readOnly:true};
  try {
    await client.connect();await client.query('BEGIN READ ONLY');await client.query('SET LOCAL statement_timeout=5000');
    result.identity=(await client.query("SELECT current_database() AS database,current_user AS role,host(inet_server_addr()) AS server_address,inet_server_port() AS server_port,current_setting('server_version') AS version,current_setting('TimeZone') AS timezone,current_setting('transaction_read_only') AS read_only")).rows[0];
    result.tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(x=>x.tablename);
    result.columns=(await client.query("SELECT table_name,column_name,udt_name,is_nullable,datetime_precision FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
    result.indexes=(await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
    result.constraints=(await client.query("SELECT c.relname AS table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname")).rows;
    if(result.tables.includes('_prisma_migrations')){
      result.migrations=(await client.query('SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name')).rows;
      result.matchesSourceMigrations=expected.every(x=>result.migrations.some(m=>m.migration_name===x.name&&m.checksum===x.checksum&&m.completed&&!m.rolled_back))&&result.migrations.length===expected.length;
    }
    result.counts={};for(const table of ['User','Booking','BookingPassenger','Session'])if(result.tables.includes(table))result.counts[table]=(await client.query(`SELECT count(*)::int AS count FROM public."${table}"`)).rows[0].count;
    result.schemaFingerprint=hash(JSON.stringify({columns:result.columns,indexes:result.indexes,constraints:result.constraints}));
    await client.query('ROLLBACK');result.rolledBack=true;
  } catch(error) {result.failure={code:['28P01','42501','42P01','ECONNREFUSED','ETIMEDOUT'].includes(error.code)?error.code:'UNCLASSIFIED'};}
  finally {await client.end().catch(()=>{});}
  return result;
}
(async()=>{
 const results=[];
 // Sequential independent read-only sessions; no app/worker imports or mutation.
 for(const name of ['DATABASE_URL','DIRECT_URL'])results.push(await inspect('server-env-'+name,env[name]));
 const report={observedUTC:new Date().toISOString(),sourceSchemaSHA256:hash(fs.readFileSync('server/prisma/schema.prisma')),sourceMigrations:expected,results,localLiveInventory:'PENDING_AVAILABLE_RUNTIME_OR_PRIVATE_OWNER_CONNECTION'};
 fs.writeFileSync('output/phase2/database-architecture-inventory.json',JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify(results.map(r=>({label:r.label,identity:r.identity,tableCount:r.tables?.length,migrationCount:r.migrations?.length,matchesSourceMigrations:r.matchesSourceMigrations,counts:r.counts,rolledBack:r.rolledBack,failure:r.failure}))));
})().catch(()=>{console.error('READONLY_ARCHITECTURE_INVENTORY_STOP');process.exitCode=1;});
