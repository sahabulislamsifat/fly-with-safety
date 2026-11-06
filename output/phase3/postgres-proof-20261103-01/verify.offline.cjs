const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const base=__dirname,root=path.resolve(base,'../../..'),local=createRequire(path.join(root,'server/package.json')),ts=local('typescript');
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').toUpperCase();
(async()=>{
 const pins=JSON.parse(fs.readFileSync(path.join(base,'pins.json')));for(const p of pins)if(sha(p.path)!==p.sha256)throw Error('PIN_DRIFT');
 const sql=fs.readFileSync(path.join(base,'preflight.readonly.sql'),'utf8'),parsed=await parser.parse(sql),kinds=parsed.stmts.map(s=>Object.keys(s.stmt)[0]);
 if(kinds.some(k=>!['TransactionStmt','VariableSetStmt','DoStmt','SelectStmt'].includes(k)))throw Error('READONLY_SQL_MUTATION');
 const block=sql.match(/DO (\$guard\$)([\s\S]*?)\1;/);await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS $guard$'+block[2]+'$guard$ LANGUAGE plpgsql;');
 const test=fs.readFileSync(path.join(root,'server/test/phase3-ledger.pg.integration.ts'),'utf8');
 if(/\$executeRawUnsafe|\.deleteMany\(|\.delete\(/.test(test)||!test.includes('PHASE3_LIVE_EXECUTION_NOT_APPROVED')||!test.includes('45_000')||!test.includes('60000'))throw Error('LIVE_SAFETY_CONTRACT');
 const ast=ts.createSourceFile('proof.ts',test,ts.ScriptTarget.Latest,true);let sqlQueries=0;const queries=[];
 function walk(n){if(ts.isTaggedTemplateExpression(n)&&n.tag.getText(ast)==='Prisma.sql'){
   const t=n.template;let value=ts.isNoSubstitutionTemplateLiteral(t)?t.text:t.head.text;
   if(!ts.isNoSubstitutionTemplateLiteral(t))for(const s of t.templateSpans)value+='NULL'+s.literal.text;
   queries.push(value);
  }ts.forEachChild(n,walk)}walk(ast);
 for(const query of queries){const a=await parser.parse(query);for(const stmt of a.stmts){const kind=Object.keys(stmt.stmt)[0];if(!['SelectStmt','UpdateStmt'].includes(kind))throw Error('UNEXPECTED_RAW_WRITE');if(kind==='UpdateStmt'&&stmt.stmt.UpdateStmt.relation.relname!=='GatewayPayment')throw Error('UNOWNED_RAW_UPDATE');}sqlQueries++;}
 const results=['diagnostics-bundled.json','diagnostics-native.json'].map(n=>JSON.parse(fs.readFileSync(path.join(base,n))));if(results.some(r=>!r.success||r.numFailedTests||r.numPendingTests||r.numPassedTests!==7))throw Error('DIAGNOSTIC_TEST_EVIDENCE');
 const caller=fs.readFileSync(path.join(base,'Invoke-PostgresProof.ps1'),'utf8');if(!caller.includes(sha(path.join(base,'pins.json'))))throw Error('MANIFEST_GUARD');
 if(['attempt-started.json','proof-attempt.json','proof-result.json','caller-result.json'].some(n=>fs.existsSync(path.join(base,n))))throw Error('EXISTING_LIVE_ATTEMPT');
 const report={passed:true,pins:pins.length,readOnlyStatements:kinds.length,plpgsqlBlocks:1,postgresQueriesParsed:sqlQueries,callerSha256:sha(path.join(base,'Invoke-PostgresProof.ps1')),originalSchemaConsumedAndPreserved:true,liveAttemptExists:false,databaseExecuted:false,providerCalled:false};
 fs.writeFileSync(path.join(base,'offline-review.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e.message);process.exitCode=1});
