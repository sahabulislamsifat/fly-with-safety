import { expect, it, vi } from 'vitest';
import { GatewayError, SSLCommerzClient, type GatewayConfig } from '../src/payments/sslcommerz.js';
import { oneQuery } from './phase3-intent-query/query.js';
const config: GatewayConfig = { storeId: 'synthetic-store', password: 'PRIVATE_TEST_ONLY', callbackOrigin: 'https://unused.invalid', frontendOrigin: 'http://localhost:3000', storageKey: Buffer.alloc(32), refunds: false };
const intent = { tranId: 'synthetic-processing', amountMinor: '1200000', currency: 'BDT' };
const row = (status: unknown) => ({ status, tran_id: intent.tranId, amount: '12000', currency: 'BDT', risk_level: '0' });
const reply = (data: unknown) => new Response(JSON.stringify(data));
it('retains PROCESSING as a rejected, unresolved diagnostic, not financial evidence', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', element: [row('PROCESSING')] }));
  const q = oneQuery(intent, { id: config.storeId, password: config.password }, transport);
  await expect(q.run()).rejects.toMatchObject({ kind: 'MALFORMED', unresolvedStatus: 'PROCESSING' });
  await expect(q.run()).rejects.toThrow('CONSUMED');
  expect(q.attempts()).toBe(1); expect(transport).toHaveBeenCalledOnce();
});
it('does not let PROCESSING authorize through Order Validation either', async () => {
  const client = new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', ...row('PROCESSING') })));
  await expect(client.validate('synthetic')).rejects.toMatchObject({ kind: 'MALFORMED', unresolvedStatus: 'PROCESSING' });
});
it.each(['processing', 'PROCESSING ', ' Processing', 'INITIATED', '', null])('does not normalize or accept unsupported status %j', async status => {
  const client = new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', element: [row(status)] })));
  await expect(client.query(intent.tranId)).rejects.toMatchObject({ kind: 'MALFORMED', unresolvedStatus: undefined });
});
it('rejects a mixed VALID/PROCESSING response as a whole', async () => {
  const client = new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', element: [{ ...row('VALID'), val_id: 'synthetic-val' }, row('PROCESSING')] })));
  await expect(client.query(intent.tranId)).rejects.toBeInstanceOf(GatewayError);
});
it.each(['PENDING', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNATTEMPTED'])('retains existing strict non-success handling %s', async status => {
  const q = oneQuery(intent, { id: config.storeId, password: config.password }, vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', element: [row(status)] })));
  const result = await q.run(); expect(result.outcomes[0].status).toBe(status); expect(result.paidAuthorized).toBe(false); expect(result.paymentStatusChanged).toBe(false); expect(result.genuineNegativeE2EAccepted).toBe(false);
});
it('does not expose response or credentials in unresolved error', async () => {
  try { await new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(reply({ APIConnect: 'DONE', element: [{ ...row('PROCESSING'), card_no: 'SENSITIVE_TEST', store_passwd: config.password }] }))).query(intent.tranId); throw Error('Expected rejection'); }
  catch (e) { expect(e).toBeInstanceOf(GatewayError); const serialized = JSON.stringify(e); expect(serialized).toContain('PROCESSING'); expect(serialized).not.toContain(config.password); expect(serialized).not.toContain('SENSITIVE_TEST'); expect(serialized).not.toContain(intent.tranId); }
});
