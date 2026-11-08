/** PREPARED ONLY. No auto-launch. Requires verified isolated runtime + individual synthetic credentials. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { BrowserType } from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';
import { isolatedOrigin, type Role, type Check } from './four-role-api.js';
type Identity = { email: string; password: string; recoveryCode?: string };
export async function runFourRoleBrowserChecks(input: {
  frontendOrigin: string; apiBase: string; identities: Record<Role, Identity>;
  assertDatabaseAndFixtureOwnership: () => Promise<void>;
  screenshot: (role: Role) => string;
}) {
  await input.assertDatabaseAndFixtureOwnership();
  const frontend = isolatedOrigin(input.frontendOrigin), api = isolatedOrigin(input.apiBase);
  assert.equal(new URL(input.apiBase).pathname, '/api/v1'); assert.equal(frontend, input.frontendOrigin);
  for (const identity of Object.values(input.identities)) assert(identity.email.endsWith('@example.invalid'));
  const { chromium } = createRequire(__filename)('C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright') as { chromium: BrowserType };
  const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 15000 });
  const results: Check[] = [];
  try {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'] as const) {
      const context = await browser.newContext();
      try {
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          return [frontend, api].includes(url.origin) ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        await page.goto(frontend, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByRole('button', { name: 'Sign in to your FlyWithSafety account', exact: true }).click();
        await page.getByLabel('Email Address', { exact: true }).fill(input.identities[role].email);
        await page.getByLabel('Password', { exact: true }).fill(input.identities[role].password);
        const login = page.waitForResponse(r => r.url() === input.apiBase + '/auth/login' && r.request().method() === 'POST');
        await page.getByRole('dialog').getByRole('button', { name: 'Sign In', exact: true }).click();
        assert.equal((await login).status(), 200);
        if (role !== 'CUSTOMER') {
          const before = await context.request.get(input.apiBase + '/identity/customers', { maxRedirects: 0 });
          assert.equal(before.status(), 403); // session authentication alone must not satisfy MFA
          await page.goto(frontend + '/account/security', { waitUntil: 'domcontentloaded' });
          assert(input.identities[role].recoveryCode, 'ACTUAL_ONE_USE_RECOVERY_CODE_REQUIRED');
          await page.getByText('Use a recovery code', { exact: true }).click();
          await page.getByLabel('Private recovery code').fill(input.identities[role].recoveryCode!);
          const mfa = page.waitForResponse(r => r.url() === input.apiBase + '/identity/mfa/recover');
          await page.getByRole('button', { name: 'Use code once', exact: true }).click();
          assert.equal((await mfa).status(), 200);
          const replay = await context.request.post(input.apiBase + '/identity/mfa/recover', {
            maxRedirects: 0, headers: { Origin: frontend }, data: { code: input.identities[role].recoveryCode },
          });
          assert.equal(replay.status(), 401);
        }
        const path = role === 'SUPER_ADMIN' ? '/owner' : role === 'CUSTOMER' ? '/account' : '/staff';
        const title = { SUPER_ADMIN: 'Super Admin Control Center', ADMIN: 'Admin Operations Console', STAFF: 'Department Staff Workspace', CUSTOMER: 'Account dashboard' }[role];
        await page.goto(frontend + path, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: title, exact: true }).waitFor();
        const own = await context.request.get(input.apiBase + '/identity/me', { maxRedirects: 0 });
        assert.equal(own.status(), 200); assert.equal((await own.json()).data.role, role);
        if (role === 'STAFF' || role === 'CUSTOMER') {
          assert.equal(await page.getByRole('heading', { name: 'Account and assignment controls', exact: true }).count(), 0);
          assert.equal((await context.request.get(input.apiBase + '/identity/audit', { maxRedirects: 0 })).status(), 403);
        }
        if (role === 'ADMIN') assert.equal((await context.request.get(input.apiBase + '/identity/audit', { maxRedirects: 0 })).status(), 403);
        if (role === 'SUPER_ADMIN') assert.equal((await context.request.get(input.apiBase + '/identity/audit', { maxRedirects: 0 })).status(), 200);
        // Capture only the workspace after password/recovery forms have been left; no HAR or storage-state export.
        await page.screenshot({ path: input.screenshot(role), fullPage: true });
        results.push({ check: role + '-actual-login-mfa-ui-and-direct-authorization', status: 'PASS' });
      } finally { await context.close(); }
    }
    await input.assertDatabaseAndFixtureOwnership(); return results;
  } finally { await browser.close(); }
}
