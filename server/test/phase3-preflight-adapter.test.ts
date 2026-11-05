import {it,expect,vi} from 'vitest';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client.js';
import {catalogSQL,originalCatalogSQL} from './phase3-db-preflight-v02.js';
import {preflightFailure} from './phase3-db-preflight-diagnostics.js';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

it('reproduces catalog char P2010 with real Prisma/adapter and a fake wire result, no connection',async()=>{
 const pool=new pg.Pool();
 const query=vi.spyOn(pool,'query').mockImplementation((async()=>({fields:[{name:'relkind',dataTypeID:18}],rows:[['r']],rowCount:1,command:'SELECT'})) as never);
 const db=new PrismaClient({adapter:new PrismaPg(pool)});
 try{await db.$queryRawUnsafe(originalCatalogSQL);throw Error('EXPECTED_ADAPTER_REJECTION');}
 catch(e){expect(preflightFailure(e,'prisma-catalog')).toMatchObject({prismaCode:'P2010',sqlState:null,adapterKind:'UnsupportedNativeDataType',nativeType:'char',classification:'ADAPTER_RESULT_TYPE'});}
 finally{await db.$disconnect();query.mockRestore();await pool.end();}
});
it('OID result is bigint and fails JSON serialization without explicit text normalization',async()=>{
 const pool=new pg.Pool(),query=vi.spyOn(pool,'query').mockImplementation((async()=>({fields:[{name:'relowner',dataTypeID:26}],rows:[['34701']],rowCount:1,command:'SELECT'})) as never),db=new PrismaClient({adapter:new PrismaPg(pool)});
 try{const rows=await db.$queryRawUnsafe<Array<{relowner:bigint}>>('SELECT relowner FROM pg_class');expect(rows[0].relowner).toBe(34701n);expect(()=>JSON.stringify(rows)).toThrow();}finally{await db.$disconnect();query.mockRestore();await pool.end();}
});
it('corrected catalog retains full owner/type identities and deserializes/serializes safely',async()=>{
 expect(catalogSQL).toBe(originalCatalogSQL.replace('c.relkind,','c.relkind::text AS relkind,').replace('c.relowner,','c.relowner::text AS relowner,').replace('a.atttypid,','a.atttypid::text AS atttypid,'));
 const pool=new pg.Pool(),query=vi.spyOn(pool,'query').mockImplementation((async()=>({fields:[{name:'relkind',dataTypeID:25},{name:'relowner',dataTypeID:25},{name:'atttypid',dataTypeID:25}],rows:[['r','4294967295','26']],rowCount:1,command:'SELECT'})) as never),db=new PrismaClient({adapter:new PrismaPg(pool)});
 try{const rows=await db.$queryRawUnsafe(catalogSQL);expect(JSON.parse(JSON.stringify(rows))).toEqual([{relkind:'r',relowner:'4294967295',atttypid:'26'}]);}finally{await db.$disconnect();query.mockRestore();await pool.end();}
});
it.each(['42501','42703','42P01','42601'])('sanitizes nested native SQLSTATE%s without persisting raw message',code=>{const e={code:'P2010',meta:{driverAdapterError:{cause:{kind:'postgres',originalCode:code,message:'PRIVATE_CALLBACK_DATA'}}}};const result=preflightFailure(e,'prisma-catalog');expect(result.sqlState).toBe(code);expect(JSON.stringify(result)).not.toContain('PRIVATE_');});
it('does not invoke malicious error getters or Proxy traps',()=>{const getter=vi.fn(()=>{throw Error('SECRET');}),e=Object.defineProperty({},'meta',{get:getter});expect(()=>preflightFailure(e,'readonly')).not.toThrow();expect(getter).not.toHaveBeenCalled();const trap=vi.fn(()=>{throw Error('SECRET');});expect(()=>preflightFailure(new Proxy({},{getOwnPropertyDescriptor:trap}),'readonly')).not.toThrow();expect(trap).not.toHaveBeenCalled();});
it('read-only entry refuses missing approval before connecting or marking an attempt',()=>{const child=spawnSync(process.execPath,[resolve(__dirname,'../node_modules/tsx/dist/cli.mjs'),resolve(__dirname,'phase3-db-preflight-readonly.ts')],{encoding:'utf8',timeout:10000});expect(child.status).toBe(1);expect(child.stderr).toContain('STOP: read-only preflight incomplete');expect(existsSync(resolve(__dirname,'../../output/phase3/db-preflight-readonly-20261104-01/attempt.json'))).toBe(false);});
