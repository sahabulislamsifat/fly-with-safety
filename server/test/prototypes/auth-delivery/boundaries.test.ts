import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import ts from 'typescript';
import { offlineBoundary } from './fixtures.js';

const root=__dirname;
const runtime=['contracts.ts','auth-delivery-codec.ts','synthetic-key-provider.ts','fake-outbox.ts','fake-transport.ts'];
const source=(f:string)=>readFileSync(resolve(root,f),'utf8');

describe('T19 offline isolation',()=>{
  it('has exactly nine files, guards before runtime imports and config-only CommonJS',async()=>{
    expect(readdirSync(root).sort()).toEqual([...runtime,'fixtures.ts','auth-delivery.test.ts','boundaries.test.ts','vitest.config.ts'].sort());
    expect(offlineBoundary.installed).toBe(true);expect(()=>net.connect({host:'synthetic.invalid',port:443})).toThrow('D3_OFFLINE_BOUNDARY');
    const config=source('vitest.config.ts');expect(config).toContain("include: ['auth-delivery.test.ts', 'boundaries.test.ts']");expect(config).toContain("setupFiles: ['./fixtures.ts']");expect(config).toContain('envDir: false');expect(config).toContain('globalSetup: []');expect(config).toContain('module.exports = authDeliveryConfig');
    const tree=ts.createSourceFile('vitest.config.ts',config,ts.ScriptTarget.Latest,true);
    expect(tree.statements.some(n=>ts.isImportDeclaration(n)||ts.isExportAssignment(n)||ts.isExportDeclaration(n))).toBe(false);
    const fixtures=ts.createSourceFile('fixtures.ts',source('fixtures.ts'),ts.ScriptTarget.Latest,true);
    for(const n of fixtures.statements)if(ts.isImportDeclaration(n)&&!n.importClause?.isTypeOnly)expect(ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('node:')).toBe(true);
    expect(source('fixtures.ts')).toContain('installOfflineGuards();');expect(typeof (await import('./auth-delivery-codec.js')).AuthDeliveryCodec).toBe('function');
  });
  it('allows only reviewed runtime imports, with no env/application/database/network access',()=>{
    for(const f of runtime){const tree=ts.createSourceFile(f,source(f),ts.ScriptTarget.Latest,true);
      const visit=(node:ts.Node)=>{
        if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier))expect(['node:crypto','node:util',...runtime.map(r=>'./'+r.replace('.ts','.js'))]).toContain(node.moduleSpecifier.text);
        if(ts.isCallExpression(node)){
          expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
          if(ts.isIdentifier(node.expression))expect(['require','eval','Function']).not.toContain(node.expression.text);
        }
        if(ts.isIdentifier(node))expect(['process','Deno','Bun','fetch','console','XMLHttpRequest','WebSocket']).not.toContain(node.text);
        ts.forEachChild(node,visit);
      };visit(tree);
    }
  });
  it.each([
    ['fetch',()=>globalThis.fetch('https://synthetic.invalid')],['tcp',()=>net.connect({host:'synthetic.invalid',port:443})],
    ['socket',()=>new net.Socket().connect(443,'synthetic.invalid')],['tls',()=>tls.connect({host:'synthetic.invalid',port:443})],
    ['http',()=>http.get('http://synthetic.invalid')],['https',()=>https.request('https://synthetic.invalid')],
    ['dns',()=>dns.lookup('synthetic.invalid',()=>{})],['dns promises',()=>dns.promises.resolve('synthetic.invalid')],
    ['udp',()=>dgram.createSocket('udp4')],['subprocess',()=>childProcess.spawn('synthetic-not-executed')],
  ] as const)('blocks %s before dispatch',(_label,operation)=>{
    const before=offlineBoundary.attempts.length;expect(operation).toThrow('D3_OFFLINE_BOUNDARY');expect(offlineBoundary.attempts.length).toBe(before+1);expect(offlineBoundary.attempts.at(-1)).not.toContain('synthetic.invalid');
  });
  it('executes all five runtime modules in a VM without process/env/app loader',async()=>{
    let envReads=0,logs=0;
    const sandbox=createContext({Buffer,Uint8Array,AbortController,performance,setTimeout,clearTimeout,
      process:new Proxy({},{get(){envReads++;throw Error('ENVIRONMENT_FORBIDDEN');}}),console:new Proxy({},{get:()=>()=>{logs++;}})});
    const trusted=createRequire(__filename),cache=new Map<string,{exports:Record<string,unknown>}>();
    const load=(name:string):unknown=>{
      expect(offlineBoundary.installed).toBe(true);if(name==='node:crypto'||name==='node:util')return trusted(name);
      const f=name.replace(/^\.\//,'').replace(/\.js$/,'.ts');if(!runtime.includes(f))throw Error('DEPENDENCY_FORBIDDEN');if(cache.has(f))return cache.get(f)!.exports;
      const module={exports:{}};cache.set(f,module);
      const compiled=ts.transpileModule(source(f),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
      const factory:unknown=runInContext(`(function(require,module,exports){${compiled}\n})`,sandbox);if(typeof factory!=='function')throw Error('INVALID_COMPILED');factory(load,module,module.exports);return module.exports;
    };
    Object.assign(sandbox,{load});
    const promise:unknown=runInContext(`(async()=>{
      const {AuthDeliveryCodec,SyntheticWorkerPolicy}=load('./auth-delivery-codec.js');
      const {SyntheticKeyProvider}=load('./synthetic-key-provider.js');
      const {FakeOutbox}=load('./fake-outbox.js');const {FakeTransport}=load('./fake-transport.js');
      const provider=new SyntheticKeyProvider();try{
        const codec=new AuthDeliveryCodec(provider,new SyntheticWorkerPolicy(()=>100),{wallNow:()=>100});
        const box=new FakeOutbox({environmentId:'synthetic-vm',codec,transport:new FakeTransport(),now:()=>100});
        const r=await box.issue({issuanceId:'synthetic-issuance',environmentId:'synthetic-vm',userId:'synthetic-user',purpose:'EMAIL_VERIFY',expectedAccountRevision:0,expectedPurposeRevision:0,expiresAtMs:1000,createAccount:{recipient:'vm@example.invalid'}});
        const grant={workerId:'synthetic-worker',environmentId:'synthetic-vm',messageId:r.messageId,tokenRecordId:r.tokenRecordId,purpose:'EMAIL_VERIFY',role:'AUTH_DELIVERY_WORKER',expiresAtMs:1000};
        return (await box.dispatch(box.claim(r.messageId,'synthetic-worker'),grant)).status==='DELIVERED';
      }finally{provider.dispose();}
    })()`,sandbox);
    expect(await promise).toBe(true);expect(envReads).toBe(0);expect(logs).toBe(0);expect([...cache.keys()].sort()).toEqual([...runtime].sort());expect(()=>load('../src/lib/prisma.js')).toThrow('DEPENDENCY_FORBIDDEN');
  });
});

describe('T20 passenger artifact byte preservation',()=>{
  const hashes={
    'README.md':'ebb9e0b8b1efeddcea6fa066ae14a8aac43e1caefc93fc32ff67df0d6a8fea53',
    'boundaries.test.ts':'d30d45f552680a630b17819232739242ec4978d2e63fa89ca5e48ac06b7e8f9e',
    'contracts.ts':'b4a8d7f2693c4e608633eec8ac942acc7d257113fb9033c19209eb874d1b1325',
    'envelope-codec.ts':'6fe22834fc66ada58772de12cc38e0bb8f58cee9ca69afa21a60ac16af687fbd',
    'fixtures.ts':'87bbd3f3820c5efb7a2fdb89dc34f06b88ece9ddc937c857e9b510912855f668',
    'passenger-document-crypto.ts':'d8282add3aafb7a2c8418f4311d5556965a7f1fc713e40cc3a03d9567a84a05e',
    'passport-crypto.test.ts':'83524f0de3eabe515abf13fbdceae5d7f63ce0869595964ad9a436a488409add',
    'synthetic-kms-adapter.ts':'d022f8bfde15c14fbb9d1909e966520a2cddcc1920d17013047d87b44c82f8d4',
    'vitest.config.ts':'ef4e7c3be9e225dbde25d218736b457db6a1dcbbe6f3b2b6a111e82e325fac5c',
  };
  it('matches the captured byte hashes for all nine existing files',()=>{
    for(const [f,hash]of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(resolve(root,'../passport-crypto',f))).digest('hex')).toBe(hash);
  });
});
