import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { checkoutURL, decimal, gatewayConfig, minor, openSession, paymentEnabled, sealSession, SSLCommerzClient, verifyNotification, type GatewayConfig } from '../src/payments/sslcommerz.js';
const config: GatewayConfig = { storeId: 'synthetic-store', password: 'SYNTHETIC-NOT-A-CREDENTIAL', storageKey: Buffer.alloc(32, 7), callbackOrigin: 'https://callbacks.example.invalid', frontendOrigin: 'http://localhost:3000', refunds: true };
const env = { SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', EMAIL_DELIVERY_ENABLED: 'false', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', DATABASE_URL: 'postgresql://flywithsafe_phase2_booking_test:synthetic@127.0.0.1:5432/flywithsafety_local_integration', SSLCOMMERZ_CALLBACK_BASE_URL: config.callbackOrigin, FRONTEND_URL: config.frontendOrigin, SSLCOMMERZ_STORAGE_KEY: config.storageKey.toString('base64'), SSLCOMMERZ_STORE_ID: config.storeId, SSLCOMMERZ_STORE_PASSWORD: config.password };
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const good = () => ({ APIConnect: 'DONE', status: 'VALID', tran_id: 'synthetic-transaction', amount: '12000.00', currency: 'BDT', val_id: 'synthetic-validation', bank_tran_id: 'synthetic-bank', risk_level: '0' });
it('defaults off and accepts only explicitly approved local sandbox activation', () => { expect(paymentEnabled({})).toBe(false); expect(gatewayConfig(env).storeId).toBe(config.storeId); });
it.each([
  { SSLCOMMERZ_ENABLED: 'false' }, { NODE_ENV: 'production' }, { SSLCOMMERZ_SANDBOX: 'false' }, { SSLCOMMERZ_SCHEMA_VERIFIED: 'false' }, { EMAIL_DELIVERY_ENABLED: 'true' },
  { DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:5432/flywithsafety_local_integration' }, { DATABASE_URL: 'postgresql://flywithsafe_phase2_booking_test:synthetic@remote.invalid:5432/flywithsafety_local_integration' },
  { SSLCOMMERZ_API_BASE_URL: 'https://securepay.sslcommerz.com' }, { SSLCOMMERZ_CALLBACK_BASE_URL: 'http://callbacks.invalid' }, { SSLCOMMERZ_STORAGE_KEY: '' },
])('fails closed on activation mismatch %j', change => expect(() => gatewayConfig({ ...env, ...change })).toThrow());
it.each(['1', '1.01', '12000.00', '99999999.99'])('uses exact decimal money %s', value => expect(minor(decimal(minor(value).toString()))).toBe(minor(value)));
it.each(['0', '-1', '1e3', '1.001', 'NaN', '100000000', '1,000', ' 1'])('rejects invalid amount %s', value => expect(() => minor(value)).toThrow());
it.each(['https://evil.invalid/a', 'http://sandbox.sslcommerz.com/', 'https://sandbox.sslcommerz.com.evil.invalid/', 'https://user:pass@sandbox.sslcommerz.com/', 'https://sandbox.sslcommerz.com/#x'])('rejects unsafe redirect %s', url => expect(() => checkoutURL(url)).toThrow());
it('encrypts sessions with random nonce and binds them to the payment identity', () => {
  const session = { sessionKey: 'synthetic-session', url: 'https://sandbox.sslcommerz.com/checkout?id=synthetic', channels: ['mobilebanking'] };
  const a = sealSession(session, 'a', config.storageKey), b = sealSession(session, 'a', config.storageKey);
  expect(a).not.toBe(b); expect(a).not.toContain(session.sessionKey); expect(openSession(a, 'a', config.storageKey)).toEqual(session);
  expect(() => openSession(a, 'b', config.storageKey)).toThrow(); expect(() => openSession(a, 'a', Buffer.alloc(32, 8))).toThrow();
  const corrupt = Buffer.from(a, 'base64'); corrupt[30] ^= 1; expect(() => openSession(corrupt.toString('base64'), 'a', config.storageKey)).toThrow();
});
it('uses genuine form initiation without restricting hosted channels or disabling TLS', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ status: 'SUCCESS', sessionkey: 'synthetic', GatewayPageURL: 'https://sandbox.sslcommerz.com/checkout', gw: { visa: 'available', mobilebanking: 'available' } }));
  const result = await new SSLCommerzClient(config, transport).initiate('synthetic', '1200000', { name: 'Synthetic', email: 'test@example.invalid', phone: '01000000000', address: 'Test address', city: 'Test city', country: 'BD', product: 'Synthetic assisted booking' });
  const [url, options] = transport.mock.calls[0], body = options!.body as URLSearchParams;
  expect(String(url)).toBe('https://sandbox.sslcommerz.com/gwprocess/v4/api.php'); expect(options!.method).toBe('POST'); expect(options!.redirect).toBe('error');
  expect(body.get('total_amount')).toBe('12000.00'); expect(body.has('multi_card_name')).toBe(false); expect(body.get('ipn_url')).toBe(config.callbackOrigin + '/api/v1/payments/sslcommerz/ipn'); expect(result.channels).toEqual(['visa', 'mobilebanking']);
});
it.each(['VALID', 'VALIDATED'])('normalizes authoritative %s including risk', async status => {
  const result = await new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(response({ ...good(), status, risk_level: '1' }))).validate('synthetic');
  expect(result.amountMinor).toBe('1200000'); expect(result.risk).toBe(true); expect(result.status).toBe(status);
});
it.each([{ APIConnect: 'FAILED' }, { APIConnect: undefined }, { store_id: 'other-store' }, { currency: 'USD' }, { risk_level: undefined }, { currency_amount: '11999.99' }, { status: 'SUCCESS' }, { amount: '12000.001' }])('rejects malformed or mismatched validation %j', async change => {
  await expect(new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(response({ ...good(), ...change }))).validate('synthetic')).rejects.toThrow();
});
it('does not expose provider bodies, URLs, credentials or raw network messages on errors', async () => {
  const secret = config.password;
  for (const transport of [vi.fn<typeof fetch>().mockRejectedValue(new Error(secret)), vi.fn<typeof fetch>().mockResolvedValue(new Response(secret, { status: 500 }))]) {
    try { await new SSLCommerzClient(config, transport).validate('synthetic'); throw Error('expected rejection'); }
    catch (e) { expect(String(e)).toBe('Error: Gateway operation unresolved'); expect(String(e)).not.toContain(secret); }
  }
});
it('rejects unbounded provider responses', async () => {
  await expect(new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(131073)))).validate('synthetic')).rejects.toThrow();
});
it('queries genuine transaction identity and normalizes all returned elements', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ APIConnect: 'DONE', element: [good()] }));
  const result = await new SSLCommerzClient(config, transport).query('synthetic');
  expect(new URL(String(transport.mock.calls[0][0])).searchParams.get('tran_id')).toBe('synthetic'); expect(result).toHaveLength(1);
});
it('requires explicit refund execution approval', async () => {
  const transport = vi.fn<typeof fetch>(); await expect(new SSLCommerzClient({ ...config, refunds: false }, transport).refund('bank', 'id', '100', 'synthetic')).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
});
it('does not treat processing or cancelled refund as completed', async () => {
  for (const status of ['processing', 'cancelled', 'refunded']) {
    const result = await new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(response({ APIConnect: 'DONE', status, refund_ref_id: 'ref', bank_tran_id: 'bank', tran_id: 'synthetic', refund_amount: '1.00' }))).refundStatus('ref');
    expect(result.status).toBe(status); expect(result.amountMinor).toBe('100');
  }
});
it('verifies the documented notification signature and rejects tampering without making it payment proof', () => {
  const fields = { amount: '12000.00', currency: 'BDT', status: 'VALID', tran_id: 'synthetic', store_passwd: createHash('md5').update(config.password).digest('hex') };
  const signature = createHash('md5').update(Object.keys(fields).sort().map(k => `${k}=${fields[k as keyof typeof fields]}`).join('&')).digest('hex');
  const form = { amount: fields.amount, currency: fields.currency, status: fields.status, tran_id: fields.tran_id, verify_key: 'tran_id,currency,amount,status', verify_sign: signature };
  expect(verifyNotification(form, config.password)).toBe('verified'); expect(verifyNotification({}, config.password)).toBe('absent');
  expect(() => verifyNotification({ ...form, amount: '1' }, config.password)).toThrow(); expect(() => verifyNotification({ ...form, verify_key: 'tran_id,tran_id' }, config.password)).toThrow();
});
it('accepts the documented refund-status response without inventing a required amount field', async () => {
  const result = await new SSLCommerzClient(config, vi.fn<typeof fetch>().mockResolvedValue(response({ APIConnect: 'DONE', status: 'refunded', refund_ref_id: 'ref', bank_tran_id: 'bank', tran_id: 'synthetic' }))).refundStatus('ref');
  expect(result.tranId).toBe('synthetic'); expect(result.amountMinor).toBeUndefined();
});
it('uses a stable unique merchant refund identity and binds the returned original transaction', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ APIConnect: 'DONE', status: 'processing', bank_tran_id: 'bank', trans_id: 'synthetic', refund_ref_id: 'ref' }));
  const result = await new SSLCommerzClient(config, transport).refund('bank', 'unique-synthetic-refund', '100', 'Synthetic');
  expect(new URL(String(transport.mock.calls[0][0])).searchParams.get('refund_trans_id')).toBe('unique-synthetic-refund'); expect(result).toEqual({ reference: 'ref', tranId: 'synthetic' });
});
