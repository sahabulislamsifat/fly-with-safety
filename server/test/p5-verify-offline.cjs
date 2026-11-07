'use strict';
// Offline tools only. No environment files, app imports, database or network.
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../..'), local = createRequire(path.join(repo, 'client/eslint.config.mjs'));
const output = path.join(repo, 'output/phase5/identity-scope');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { ESLint } = local('eslint'), tsEslint = createRequire(local.resolve('eslint-config-next'))('typescript-eslint');
  const eslint = new ESLint({ cwd: repo, overrideConfigFile: true, overrideConfig: [...tsEslint.configs.recommended,
    { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }] });
  const files = ['server/src/identity/*.ts', 'server/test/p5-*.ts', 'server/src/app.ts',
    'server/src/controllers/auth.controller.ts', 'server/src/middleware/auth.middleware.ts', 'server/src/routes/admin.routes.ts',
    'server/src/services/auth.service.ts', 'server/src/services/booking-commercial.service.ts', 'server/src/services/inquiry-status.service.ts',
    'server/src/payments/payment-domain.ts', 'server/src/payments/payment-store.ts', 'server/src/payments/payment.routes.ts', 'server/src/payments/payment.service.ts', 'server/prisma/seed.ts'];
  const lint = await eslint.lintFiles(files);
  const lintResult = { files: lint.length, errors: lint.reduce((n, r) => n + r.errorCount, 0), warnings: lint.reduce((n, r) => n + r.warningCount, 0), findings: lint.filter(r => r.messages.length).map(r => ({ file: path.relative(repo, r.filePath), messages: r.messages })) };
  fs.writeFileSync(path.join(output, 'lint.json'), JSON.stringify(lintResult, null, 2));
  console.log('P5_LINT', JSON.stringify(lintResult));
  if (lintResult.errors || lintResult.warnings) process.exitCode = 1;
  const parserPath = process.argv[2];
  if (!parserPath) throw Error('Explicit local libpg-query parser path required; no install/network fallback');
  const parser = require(parserPath), ts = require('../node_modules/typescript');
  const migration = fs.readFileSync(path.join(repo, 'server/prisma/migrations/20261107000100_identity_scope/migration.sql'), 'utf8');
  await parser.parse(migration);
  let statements = 0;
  for (const name of fs.readdirSync(path.join(repo, 'server/src/identity')).filter(n => n.endsWith('.ts'))) {
    const file = path.join(repo, 'server/src/identity', name), tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const queries = [];
    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && node.tag.getText(tree) === 'Prisma.sql') {
        let sql = node.template.text;
        if (ts.isTemplateExpression(node.template)) {
          sql = node.template.head.text;
          for (const part of node.template.templateSpans) {
            const expression = part.expression.getText(tree);
            sql += (/Prisma\.raw|^column$/.test(expression) ? '"synthetic_identifier"' : 'NULL') + part.literal.text;
          }
        }
        if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/.test(sql || '')) queries.push(sql);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const sql of queries) { await parser.parse(sql); statements++; }
  }
  const sqlResult = { passed: true, migrationParsed: true, identityTemplatesParsed: statements, substitution: 'NULL values and fixed quoted identifiers; syntax only', databaseConnections: 0 };
  fs.writeFileSync(path.join(output, 'sql.json'), JSON.stringify(sqlResult, null, 2));
  console.log('P5_SQL', JSON.stringify(sqlResult));
}
main().catch(error => { console.error('P5_OFFLINE_VERIFICATION_FAILED', error instanceof Error ? error.message : 'tool failure'); process.exitCode = 1; });
