const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const local=createRequire(path.resolve(__dirname,'../../server/package.json'));
const env=local('dotenv').parse(fs.readFileSync('server/.env'));
const previous=JSON.parse(fs.readFileSync('output/phase2/database-architecture-inventory.json'));
(async()=>{const results=[];for(const key of ['DATABASE_URL','DIRECT_URL']){
 const client=new(local('pg').Client)({connectionString:env[key],connectionTimeoutMillis:8000,query_timeout:8000});client.on('error',()=>{});
 const result={configurationKey:key,readOnly:true};
 try{await client.connect();await client.query('BEGIN READ ONLY');await client.query('SET LOCAL statement_timeout=5000');
 result.identity=(await client.query("SELECT current_database() AS database,current_user AS role,host(inet_server_addr()) AS server_address,inet_server_port() AS server_port")).rows[0];
 result.counts=(await client.query('SELECT (SELECT count(*)::int FROM public."User") AS users,(SELECT count(*)::int FROM public."Booking") AS bookings')).rows[0];
 const ledger=(await client.query('SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name')).rows;
 const old=previous.results.find(x=>x.label==='server-env-'+key);
 result.sameObservedIdentity=Object.entries(result.identity).every(([k,v])=>old.identity[k]===v);
 result.sameUserBookingCounts=result.counts.users===old.counts.User&&result.counts.bookings===old.counts.Booking;
 result.sameMigrationLedger=JSON.stringify(ledger)===JSON.stringify(old.migrations);
 await client.query('ROLLBACK');result.rolledBack=true;result.currentCredentialAccepted=true;
 }catch(error){result.failure=['28P01','42501','ECONNREFUSED'].includes(error.code)?error.code:'UNCLASSIFIED'}finally{await client.end().catch(()=>{})}results.push(result);
 }
 const report={observedUTC:new Date().toISOString(),results,resourceIdsIndependentlyVerified:false,stagingCredentialAvailable:false,comparisonDoesNotProveFullRowEquality:true};
 fs.writeFileSync('output/phase2/database-rename-check.json',JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
})().catch(()=>{console.error('READONLY_RENAME_CHECK_STOP');process.exitCode=1;});
