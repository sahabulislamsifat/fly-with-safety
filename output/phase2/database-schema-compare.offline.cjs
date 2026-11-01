const fs=require('node:fs');
const schema=fs.readFileSync('server/prisma/schema.prisma','utf8');
const inventory=JSON.parse(fs.readFileSync('output/phase2/database-architecture-inventory.json'));
const enums=new Set([...schema.matchAll(/^enum\s+(\w+)/gm)].map(x=>x[1]));
const scalars=new Set(['String','Int','Boolean','DateTime','Json','Decimal','BigInt','Float','Bytes',...enums]);
const expected={};
for(const model of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
 expected[model[1]]=[];
 for(const line of model[2].split('\n')) {const field=line.match(/^\s*(\w+)\s+(\w+)(?:\?|\[\])?/);if(field&&scalars.has(field[2]))expected[model[1]].push(field[1]);}
}
const cloud=inventory.results[0],missing=[],extra=[];
for(const [model,fields]of Object.entries(expected)) {
 const columns=cloud.columns.filter(c=>c.table_name===model).map(c=>c.column_name);
 missing.push(...fields.filter(x=>!columns.includes(x)).map(x=>model+'.'+x));
 extra.push(...columns.filter(x=>!fields.includes(x)).map(x=>model+'.'+x));
}
const result={modelCount:Object.keys(expected).length,applicationColumns:Object.values(expected).flat().length,missingColumns:missing,extraColumns:extra,
 cloudApplicationColumnNamesMatch:missing.length===0&&extra.length===0,
 migrationNamesAbsent:inventory.sourceMigrations.filter(x=>!cloud.migrations.some(m=>m.migration_name===x.name)).map(x=>x.name),
 checksumDifferences:inventory.sourceMigrations.filter(x=>cloud.migrations.some(m=>m.migration_name===x.name&&m.checksum!==x.checksum)).map(x=>x.name),
 completedDistinctMigrations:new Set(cloud.migrations.filter(x=>x.completed&&!x.rolled_back).map(x=>x.migration_name)).size,
 rolledBackAttempts:cloud.migrations.filter(x=>x.rolled_back).length,
 foreignKeys:cloud.constraints.filter(x=>x.contype==='f').length,
 interpretation:'Physical application column names match is distinct from migration-ledger equivalence; local live catalog and enum/default comparisons remain pending.'};
fs.writeFileSync('output/phase2/database-schema-comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
