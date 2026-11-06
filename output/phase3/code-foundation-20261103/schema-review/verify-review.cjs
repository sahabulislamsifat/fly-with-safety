const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const parser=require('C:/Users/sahab/.codex/visualizations/2026/10/21/01a15fd3-69ff-7843-bea7-539c3d6111f9/phase1-gatea-ledger-close-20261030-01/parser-tool/node_modules/libpg-query');
const base=__dirname,sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
(async()=>{
 const pins=JSON.parse(fs.readFileSync(path.join(base,'pins.json'))); for(const p of pins)if(sha(p.path)!==p.sha256)throw Error('SOURCE_PIN_MISMATCH');
 const sql=fs.readFileSync(path.join(base,'apply.review.sql'),'utf8'),ast=await parser.parse(sql);let blocks=0;
 for(const m of sql.matchAll(/DO\s+(\$\w+\$)([\s\S]*?)\1;/g)){await parser.parsePlPgSQL('CREATE FUNCTION __offline_only__() RETURNS void AS '+m[1]+m[2]+m[1]+' LANGUAGE plpgsql;');blocks++;}
 for(const m of sql.matchAll(/CREATE FUNCTION[\s\S]*?\$(payment|refund)\$;/g)){await parser.parsePlPgSQL(m[0]);blocks++;}
 if(blocks!==6)throw Error('EXPECTED_SIX_PLPGSQL_BLOCKS');
 const kinds=ast.stmts.map(s=>Object.keys(s.stmt)[0]);
 const allowed=new Set(['TransactionStmt','VariableSetStmt','DoStmt','CreateStmt','IndexStmt','CreateFunctionStmt','CreateTrigStmt','GrantStmt','GrantRoleStmt','InsertStmt','SelectStmt']);
 if(kinds.some(k=>!allowed.has(k)))throw Error('UNEXPECTED_SQL_STATEMENT');
 if(kinds.filter(k=>k==='CreateStmt').length!==3||kinds.filter(k=>k==='InsertStmt').length!==1)throw Error('UNEXPECTED_MUTATION_COUNT');
 const insert=ast.stmts.find(s=>s.stmt.InsertStmt).stmt.InsertStmt;
 if(insert.relation.relname!=='_prisma_migrations'||insert.relation.schemaname!=='public')throw Error('UNEXPECTED_EXISTING_TABLE_INSERT');
 const tables=ast.stmts.filter(s=>s.stmt.CreateStmt).map(s=>s.stmt.CreateStmt.relation.relname).sort();
 if(JSON.stringify(tables)!==JSON.stringify(['GatewayPayment','GatewayPaymentEvent','GatewayRefund']))throw Error('UNEXPECTED_CREATE_TARGET');
 const caller=fs.readFileSync(path.join(base,'Invoke-Phase3Schema.ps1'),'utf8');
 if(!caller.includes(sha(path.join(base,'pins.json')))||caller.includes('__MANIFEST_SHA__'))throw Error('CALLER_MANIFEST_GUARD_MISMATCH');
 if((caller.match(/& \$psql /g)||[]).length!==1||/\\connect/.test(sql))throw Error('EXPECTED_ONE_NATIVE_CONNECTION');
 const result={passed:true,pins:pins.length,sqlStatements:kinds.length,plpgsqlBlocks:blocks,newTables:tables,existingTableDml:'one new migration ledger INSERT only',nativeConnections:1,callerSha256:sha(path.join(base,'Invoke-Phase3Schema.ps1')),attemptExists:fs.existsSync(path.join(base,'attempt.json')),databaseExecuted:false};
 fs.writeFileSync(path.join(base,'offline-review.json'),JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e.message);process.exitCode=1});
