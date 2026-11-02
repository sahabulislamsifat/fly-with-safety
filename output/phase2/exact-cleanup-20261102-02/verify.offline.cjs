const fs=require('fs'),crypto=require('crypto');
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
const base=__dirname,old=base.replace(/exact-cleanup-20261102-02$/,'exact-cleanup-20261102-01');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
(async()=>{
 const review=JSON.parse(fs.readFileSync(base+'/review-source.json'));let checks=0;
 const check=(ok,name)=>{if(!ok)throw Error(name);checks++;};
 for(const [p,h] of Object.entries(review.originalFileHashes))check(sha(p)===h,'ORIGINAL_EVIDENCE_CHANGED');
 const pins=JSON.parse(fs.readFileSync(old+'/pins.json'));for(const p of pins)check(sha(p.path)===p.sha256,'ORIGINAL_PIN_DRIFT');
 const fields=new Set(review.actualCatalogColumns.map(c=>c.name));
 check(fields.has('payload')&&!fields.has('template')&&!fields.has('params'),'REAL_CATALOG_EXPECTATION');
 let statements=0,blocks=0;const queryRefs=async(sql)=>{const ast=await parser.parse(sql);const names=[];function walk(x){if(!x||typeof x!=='object')return;if(x.ColumnRef){const last=x.ColumnRef.fields.at(-1);if(last.String)names.push(last.String.sval);}for(const v of Object.values(x))if(v!==x)walk(v);}walk(ast);return [...new Set(names)];};
 for(const file of ['cleanup.review.sql','reconcile.readonly.sql']){
  const sql=fs.readFileSync(base+'/'+file,'utf8'),original=fs.readFileSync(old+'/'+file,'utf8');
  const ast=await parser.parse(sql.replace(/^\\.*$/gm,''));statements+=ast.stmts.length;
  for(const m of sql.matchAll(/DO\s+(\$\w+\$)([\s\S]*?)\1;/g)){await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS '+m[1]+m[2]+m[1]+' LANGUAGE plpgsql;');blocks++;}
  let reversed=sql.replace('\n'+review.addedValidationSQL,'');for(const [a,b]of review.corrections)reversed=reversed.replace(b,a);check(reversed===original,'ONLY_REVIEWED_DELTA');
  check((sql.match(/DELETE FROM public\."\w+" WHERE id=ANY\(\w+\);/g)||[]).join('\n')===(original.match(/DELETE FROM public\."\w+" WHERE id=ANY\(\w+\);/g)||[]).join('\n'),'DELETE_SCOPE_CHANGED');
  const guard=sql.split('\n').find(l=>l.includes('OUTBOX_OWNERSHIP_OR_ACTIVE_CLAIM_MISMATCH'));
  const query=guard.slice(guard.indexOf('SELECT FROM'),guard.indexOf(' THEN RAISE')-1)+';';
  const refs=await queryRefs(query);check(refs.every(r=>fields.has(r)||r==='notification_ids'||r==='user_emails'||r==='booking_refs'),'CORRECTED_COLUMN_NOT_IN_ACTUAL_CATALOG');
  const oldGuard=original.split('\n').find(l=>l.includes('OUTBOX_OWNERSHIP_OR_ACTIVE_CLAIM_MISMATCH'));const oldQuery=oldGuard.slice(oldGuard.indexOf('SELECT FROM'),oldGuard.indexOf(' THEN RAISE')-1)+';';
  const bad=await queryRefs(oldQuery);check(bad.filter(r=>!fields.has(r)&&!['notification_ids','user_emails','booking_refs'].includes(r)).sort().join(',')==='params,template','ORIGINAL_BUG_MUST_BE_CAUGHT');
  check(sql.includes("coalesce(payload->>'template','') NOT IN(")&&sql.includes("coalesce(payload->'params'->>'referenceNumber','')")&&sql.includes("jsonb_typeof(payload->'params'->'referenceNumber') IS DISTINCT FROM 'string'"),'NULL_MALFORMED_PAYLOAD_FAIL_CLOSED');
  if(file==='reconcile.readonly.sql'){
   check(ast.stmts.every(s=>['TransactionStmt','VariableSetStmt','DoStmt','SelectStmt'].includes(Object.keys(s.stmt)[0])),'READONLY_AST_ALLOWLIST');
   check(!/\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|CREATE|DROP|TRUNCATE|CALL|COPY|LOCK)\b/i.test(sql.replace(/'([^']|'')*'/g,"''")),'READONLY_BODY_ALLOWLIST');
   check(sql.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;')&&sql.includes('ROLLBACK;'),'READONLY_TRANSACTION');
  }
 }
 const sources=JSON.parse(fs.readFileSync('output/phase2/final-regression-20261102-02/source-pins.json'));for(const p of sources)check(sha(p.path)===p.sha256.toUpperCase(),'REGRESSION_SOURCE_DRIFT');
 check(sha(base+'/RECONCILE-READONLY-ONCE.txt')===review.commandSha256,'COMMAND_CHANGED');
 check(!['reconcile-readonly-attempt.json','reconcile-readonly-output.txt','reconcile-readonly-result.json'].some(p=>fs.existsSync(base+'/'+p)),'NEW_ATTEMPT_EXISTS');
 const report={passed:true,checks,statements,plpgsqlBlocks:blocks,savedActualCatalogColumns:fields.size,originalFilesPreserved:Object.keys(review.originalFileHashes).length,cleanupPins:pins.length,unchangedRegressionSourcePins:sources.length,originalBadColumnsDetected:['params','template'],databaseExecuted:false,liveNotificationPayloadShape:'UNVERIFIED_REQUIRES_APPROVED_READONLY_EXECUTION'};
 fs.writeFileSync(base+'/offline-result.json',JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
