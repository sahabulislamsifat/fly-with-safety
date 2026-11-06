const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const { createRequire } = require('node:module');
const clientRequire = createRequire(path.join(root, 'client/eslint.config.mjs'));
const { ESLint } = clientRequire('eslint');
const ts = createRequire(clientRequire.resolve('eslint-config-next'))('typescript-eslint');
(async () => {
  const runner = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: ts.configs.recommended });
  const result = await runner.lintFiles(['server/src/payments/payment-store.ts', 'server/test/phase3-clock.test.ts', 'server/test/phase3-proof-diagnostics.ts', 'server/test/phase3-proof-diagnostics.test.ts', 'server/test/phase3-ledger.pg.integration.ts']);
  const report = { errors: result.reduce((n, r) => n + r.errorCount, 0), warnings: result.reduce((n, r) => n + r.warningCount, 0), files: result.map(r => ({ path: path.relative(root, r.filePath), messages: r.messages })) };
  fs.writeFileSync(path.join(__dirname, 'eslint.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); process.exitCode = report.errors || report.warnings ? 1 : 0;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
