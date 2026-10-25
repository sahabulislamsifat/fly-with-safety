import { describe, expect, it } from 'vitest';
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

const root = __dirname;
const runtime = ['contracts.ts', 'envelope-codec.ts', 'passenger-document-crypto.ts', 'synthetic-kms-adapter.ts'];
const source = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('14 offline boundaries', () => {
  it('R17/R18 installs setup guards before explicitly importing runtime modules', async () => {
    expect(offlineBoundary.installed).toBe(true);
    expect(() => net.connect({ host: 'synthetic.invalid', port: 443 })).toThrow('D1_OFFLINE_BOUNDARY');
    const fixtureAst = ts.createSourceFile('fixtures.ts', source('fixtures.ts'), ts.ScriptTarget.Latest, true);
    for (const node of fixtureAst.statements) {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
        expect(ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('node:')).toBe(true);
      }
    }
    const configAst = ts.createSourceFile('vitest.config.ts', source('vitest.config.ts'), ts.ScriptTarget.Latest, true);
    expect(configAst.statements.some(n => ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isExportAssignment(n))).toBe(false);
    const loaded = await import('./passenger-document-crypto.js');
    expect(typeof loaded.PassengerDocumentCrypto).toBe('function');
    expect(offlineBoundary.installed).toBe(true);
  });
  it('has exactly nine approved files and an isolated exact test configuration', () => {
    expect(readdirSync(root).sort()).toEqual(['README.md', 'boundaries.test.ts', 'contracts.ts', 'envelope-codec.ts', 'fixtures.ts', 'passport-crypto.test.ts', 'passenger-document-crypto.ts', 'synthetic-kms-adapter.ts', 'vitest.config.ts'].sort());
    const config = source('vitest.config.ts');
    expect(config).toContain("include: ['passport-crypto.test.ts', 'boundaries.test.ts']");
    expect(config).toContain('envDir: false');
    expect(config).toContain("setupFiles: ['./fixtures.ts']");
    expect(source('fixtures.ts')).toContain('installOfflineGuards();');
    expect(config).toContain('module.exports = prototypeConfig');
    expect(config).not.toContain('export default');
    expect(config).not.toContain('export const');
    expect(source('fixtures.ts')).not.toContain("from './vitest.config.js'");
    expect(offlineBoundary.installed).toBe(true);
  });

  it('confines runtime imports to the four reviewed modules and two safe built-ins', () => {
    for (const file of runtime) {
      const tree = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const dependency = node.moduleSpecifier.text;
          expect(['node:crypto', 'node:util', ...runtime.map(f => `./${f.replace('.ts', '.js')}`)]).toContain(dependency);
        }
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
          if (ts.isIdentifier(node.expression)) expect(['require', 'eval', 'Function']).not.toContain(node.expression.text);
        }
        if (ts.isIdentifier(node)) expect(['process', 'Deno', 'Bun', 'fetch', 'console', 'XMLHttpRequest', 'WebSocket']).not.toContain(node.text);
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  });

  it.each([
    ['fetch', () => globalThis.fetch('https://synthetic.invalid')],
    ['net', () => net.connect({ host: 'synthetic.invalid', port: 443 })],
    ['socket', () => new net.Socket().connect(443, 'synthetic.invalid')],
    ['tls', () => tls.connect({ host: 'synthetic.invalid', port: 443 })],
    ['http', () => http.get('http://synthetic.invalid')],
    ['https', () => https.request('https://synthetic.invalid')],
    ['dns', () => dns.lookup('synthetic.invalid', () => {})],
    ['dns promises', () => dns.promises.resolve('synthetic.invalid')],
    ['udp', () => dgram.createSocket('udp4')],
    ['subprocess', () => childProcess.spawn('synthetic-never-executed')],
  ] as const)('blocks %s before dispatch without recording arguments', (_name, operation) => {
    const before = offlineBoundary.attempts.length;
    expect(operation).toThrow('D1_OFFLINE_BOUNDARY');
    expect(offlineBoundary.attempts.length).toBe(before + 1);
    expect(offlineBoundary.attempts.at(-1)).not.toContain('synthetic.invalid');
  });

  it('loads and runs runtime modules in a VM with an inaccessible environment and no app/DB loader', async () => {
    let environmentReads = 0;
    let logCalls = 0;
    const sandbox = createContext({ Buffer, Uint8Array, AbortController, performance, setTimeout, clearTimeout,
      process: new Proxy({}, { get() { environmentReads++; throw Error('ENVIRONMENT_FORBIDDEN'); } }),
      console: new Proxy({}, { get: () => () => { logCalls++; } }),
    });
    const trustedRequire = createRequire(__filename);
    const cache = new Map<string, { exports: Record<string, unknown> }>();
    const load = (name: string): unknown => {
      expect(offlineBoundary.installed).toBe(true);
      if (name === 'node:crypto' || name === 'node:util') return trustedRequire(name);
      const file = name.replace(/^\.\//, '').replace(/\.js$/, '.ts');
      if (!runtime.includes(file)) throw Error('DEPENDENCY_FORBIDDEN');
      if (cache.has(file)) return cache.get(file)!.exports;
      const module = { exports: {} };
      cache.set(file, module);
      const compiled = ts.transpileModule(source(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      const factory: unknown = runInContext(`(function(require,module,exports){${compiled}\n})`, sandbox);
      if (typeof factory !== 'function') throw Error('INVALID_COMPILED_MODULE');
      factory(load, module, module.exports);
      return module.exports;
    };
    Object.assign(sandbox, { load });
    const result: unknown = runInContext(`(async () => {
      const { PassengerDocumentCrypto, SyntheticAuthorizationPolicy } = load('./passenger-document-crypto.js');
      const { SyntheticKmsAdapter } = load('./synthetic-kms-adapter.js');
      const provider = new SyntheticKmsAdapter();
      try {
        const context = {environmentId:'synthetic-vm',bookingId:'synthetic-booking',passengerId:'synthetic-passenger'};
        const grant = {...context,actorId:'synthetic-actor',role:'FULFILLMENT',purpose:'synthetic-fulfillment',expiresAtMs:200,stepUpVerified:true};
        const crypto = new PassengerDocumentCrypto(provider,new SyntheticAuthorizationPolicy(()=>100),3,{wallNow:()=>100});
        const result = await crypto.decrypt(await crypto.encrypt({passportNumber:'SYNTHETIC-VM'},context),context,grant);
        return result.passportNumber === 'SYNTHETIC-VM';
      } finally { provider.dispose(); }
    })()`, sandbox);
    expect(await result).toBe(true);
    expect(environmentReads).toBe(0);
    expect(logCalls).toBe(0);
    expect([...cache.keys()].sort()).toEqual([...runtime].sort());
    expect(() => load('../src/lib/prisma.js')).toThrow('DEPENDENCY_FORBIDDEN');
  });
});
