const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const npx = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const checks = process.argv.includes('--production-routes') ? [['route-audit', 'production-routes']] : [['route-audit', 'routes'], ['calendar-check', 'calendars'], ['interaction-check', 'interactions'], ['form-check', 'forms']];
for (const [script, artifact] of checks) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=flyaudit', 'run-code', `--filename=output/playwright/${script}.js`, '--raw'], { encoding: 'utf8', timeout: 180000 });
  const result = JSON.parse(output.trim());
  fs.writeFileSync(`output/playwright/${artifact}-after.json`, JSON.stringify(result, null, 2));
  if (Array.isArray(result)) {
    const failures = result.filter(route => route.status !== 200 || route.errors.length || route.widths.some(size => size.scrollWidth > size.width));
    if (failures.length) throw new Error(JSON.stringify(failures));
    console.log(`${artifact}: ${result.length} routes, ${result.length * 6} viewport checks passed`);
  } else {
    if (result.failed.length) throw new Error(JSON.stringify(result.failed));
    console.log(`${artifact}: ${result.checks.length} checks passed`);
  }
}
