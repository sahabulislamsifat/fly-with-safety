const path = require('node:path'), fs = require('node:fs'), { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..'), clientRequire = createRequire(path.join(root, 'client/eslint.config.mjs'));
const { ESLint } = clientRequire('eslint');
const nextRequire = createRequire(clientRequire.resolve('eslint-config-next'));
const ts = nextRequire('typescript-eslint');
(async () => {
 const server = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: ts.configs.recommended });
 const a = await server.lintFiles(['server/src/payments/**/*.ts', 'server/test/phase3-*.ts']);
 const client = new ESLint({ cwd: path.join(root, 'client') });
 const b = await client.lintFiles(['src/components/booking/GatewayPaymentPanel.tsx', 'src/components/booking/GatewayReturn.tsx', 'app/payments/return/page.tsx', 'src/components/booking/BookingCommercialPanel.tsx', 'src/components/admin/AdminBookingsTab.tsx']);
 const results = [...a, ...b];
 const report = { errors: results.reduce((n,r) => n + r.errorCount,0), warnings: results.reduce((n,r) => n + r.warningCount,0), files: results.map(r => ({ path: path.relative(root,r.filePath), messages: r.messages })) };
 fs.writeFileSync(path.join(__dirname,'eslint.json'), JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2)); process.exitCode = report.errors || report.warnings ? 1 : 0;
})().catch(e=>{console.error(e.message);process.exitCode=1});
