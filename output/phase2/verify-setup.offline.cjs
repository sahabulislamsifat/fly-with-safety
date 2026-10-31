const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
(async()=>{
 const results=[];
 for(const name of ['create-target.sql','role.sql']){
  const source=fs.readFileSync(path.join(__dirname,'setup-review',name),'utf8');
  assert(!/^\s*(?:DELETE|DROP|TRUNCATE)\b/m.test(source));
  assert(!source.includes('phase1_schema_integration'));
  const parsed=await parser.parse(source.replace(/^\s*\\.*$/gm,''));let blocks=0;
  for(const m of source.matchAll(/\bDO\s+(\$[A-Za-z_][A-Za-z0-9_]*\$)([\s\S]*?)\1\s*;/g)){
   await parser.parsePlPgSQL(`CREATE FUNCTION __offline_only__() RETURNS void AS ${m[1]}${m[2]}${m[1]} LANGUAGE plpgsql;`);blocks++;
  }
  results.push({file:name,statements:parsed.stmts.length,blocks});
 }
 console.log(JSON.stringify({passed:true,postgresParser:'18.2.2',results,databaseConnections:0,executed:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
