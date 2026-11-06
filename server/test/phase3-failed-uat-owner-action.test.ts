import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client.js';
import { checkoutStopReason, failedOwnerPage, failedOwnerReady } from './phase3-failed-uat-v03/owner-action.js';
import { verifyRetainedCloudflare } from './phase3-failed-uat-v03/retained-cloudflare.js';

vi.mock('./phase3-failed-uat-v03/retained.js', () => ({ verifyPriorFailed: vi.fn() }));

const origin = 'http://127.0.0.1:49123';
const nonce = 'a'.repeat(64);
const scope = { origin, nonce, activeCase: 'fail', stopped: false };
const owner = { peer: '127.0.0.1', host: '127.0.0.1:49123', origin, nonce, case: 'fail', action: 'FAILED_ONLY_DUMMY_OTP' };
const callback = 'https://synthetic-probe.trycloudflare.com';

it('shows the FAILED-only action and requires its explicit acknowledgement before Checkout', () => {
  const page = failedOwnerPage(nonce);
  expect(page).toMatch(/Mobile Banking.*sandbox channel.*Dummy OTP.*Failed exactly once/s);
  expect(page).toContain('Do not press X or confirm YES, CANCEL.');
  expect(page).toContain('name="action" value="FAILED_ONLY_DUMMY_OTP" required');
  expect(failedOwnerReady(owner, scope, 'initial')).toBe(true);
  expect(failedOwnerReady({ ...owner, action: undefined }, scope, 'initial')).toBe(false);
  expect(failedOwnerReady({ ...owner, case: 'cancel', action: 'YES_CANCEL' }, scope, 'initial')).toBe(false);
});

it('keeps the private origin and nonce guards and refuses a second confirmation', () => {
  expect(failedOwnerReady({ ...owner, origin: callback }, scope, 'initial')).toBe(false);
  expect(failedOwnerReady({ ...owner, nonce: 'wrong' }, scope, 'initial')).toBe(false);
  expect(failedOwnerReady(owner, { ...scope, stopped: true }, 'initial')).toBe(false);
  expect(failedOwnerReady(owner, scope, 'initiating')).toBe(false);
});

it('stops for the sandbox warning and the owned browser’s conflicting POST, without treating GET as an outcome', () => {
  const cancel = callback + '/api/v1/payments/sslcommerz/cancel';
  expect(checkoutStopReason(cancel, callback, 'POST', 404)).toBe('OWNER_BROWSER_OUT_OF_CASE_CANCEL');
  expect(checkoutStopReason(cancel, callback, 'GET', 404)).toBeUndefined();
  expect(checkoutStopReason(cancel, 'https://other.trycloudflare.com', 'POST', 404)).toBeUndefined();
  expect(checkoutStopReason('https://sandbox.sslcommerz.com/gwprocess/warning.php', callback, 'GET', 200)).toBe('SSL_SANDBOX_WARNING_PAGE');
  expect(checkoutStopReason('https://other.invalid/warning.php', callback, 'GET', 200)).toBeUndefined();
});

it('matches the dashboard merchant ID only against the exact retained fixture, and rejects a changed capture flag', async () => {
  const repo = resolve(__dirname, '../..');
  const saved = JSON.parse(readFileSync(resolve(repo, 'output/phase3/failed-uat-cloudflare-20261106-01/owned-final.json'), 'utf8'));
  const payment = { ...saved.payments[0], tranId: 'FWS96701848208cfaad3846c7e850' };
  const findUnique = vi.fn().mockResolvedValue(saved.bookings[0]);
  const rows = vi.fn().mockResolvedValue([payment]);
  const db = { booking: { findUnique }, $queryRawUnsafe: rows } as unknown as Prisma.TransactionClient;
  await expect(verifyRetainedCloudflare(db, repo)).resolves.toEqual({ priorCloudflarePreserved: true, dashboardMerchantIdMatched: true });
  expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: saved.bookings[0].id } }));
  rows.mockResolvedValueOnce([{ ...payment, tranId: 'FWS00000000000000000000000000' }]);
  await expect(verifyRetainedCloudflare(db, repo)).resolves.toEqual({ priorCloudflarePreserved: true, dashboardMerchantIdMatched: false });
  rows.mockResolvedValueOnce([{ ...payment, captured: true }]);
  await expect(verifyRetainedCloudflare(db, repo)).rejects.toThrow('PRIOR_CLOUDFLARE_STATE_CHANGED');
});
