import { z } from 'zod';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/errors.js';

const apiOrigin = 'https://sandbox.sslcommerz.com';
export type GatewayConfig = { storeId: string; password: string; callbackOrigin: string; frontendOrigin: string; storageKey: Buffer; refunds: boolean };
export function paymentEnabled(input = process.env) { return input.SSLCOMMERZ_ENABLED === 'true'; }
export function gatewayConfig(input = process.env): GatewayConfig {
  if (!paymentEnabled(input)) throw new AppError('Sandbox payments are not enabled', 503, 'PAYMENTS_DISABLED');
  if (input.SSLCOMMERZ_SANDBOX !== 'true' || input.NODE_ENV === 'production' || input.EMAIL_DELIVERY_ENABLED !== 'false' || input.SSLCOMMERZ_SCHEMA_VERIFIED !== 'true')
    throw new AppError('Sandbox payment activation is not approved', 503, 'PAYMENTS_DISABLED');
  let db: URL, callback: URL, frontend: URL;
  try { db = new URL(input.DATABASE_URL || ''); callback = new URL(input.SSLCOMMERZ_CALLBACK_BASE_URL || ''); frontend = new URL(input.FRONTEND_URL || ''); }
  catch { throw AppError.internal('Payment configuration unavailable'); }
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '5432' || db.pathname !== '/flywithsafety_local_integration' || db.username !== 'flywithsafe_phase2_booking_test' || !db.password || db.search || db.hash ||
      callback.protocol !== 'https:' || callback.username || callback.password || callback.search || callback.hash || callback.pathname !== '/' ||
      !['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || frontend.pathname !== '/' || frontend.search || frontend.hash ||
      input.SSLCOMMERZ_API_BASE_URL && input.SSLCOMMERZ_API_BASE_URL !== apiOrigin)
    throw AppError.internal('Payment configuration unavailable');
  const key = Buffer.from(input.SSLCOMMERZ_STORAGE_KEY || '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== input.SSLCOMMERZ_STORAGE_KEY || !input.SSLCOMMERZ_STORE_ID || !input.SSLCOMMERZ_STORE_PASSWORD)
    throw AppError.internal('Payment configuration unavailable');
  return { storeId: input.SSLCOMMERZ_STORE_ID, password: input.SSLCOMMERZ_STORE_PASSWORD, callbackOrigin: callback.origin, frontendOrigin: frontend.origin, storageKey: key, refunds: input.SSLCOMMERZ_REFUNDS_APPROVED === 'true' };
}
export function checkoutURL(value: unknown): string {
  try { const u = new URL(z.string().max(2048).parse(value)); if (u.origin !== apiOrigin || u.username || u.password || u.hash) throw Error(); return u.href; }
  catch { throw new GatewayError('MALFORMED'); }
}
export function minor(value: string): bigint {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) throw new GatewayError('MISMATCH');
  const [whole, fraction = ''] = value.split('.'); const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result < 1n || result > 9_999_999_999n) throw new GatewayError('MISMATCH'); return result;
}
export function decimal(value: string): string { const n = BigInt(value); if (n < 1n || n > 9_999_999_999n) throw AppError.badRequest('Gateway amount is outside supported bounds'); return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`; }
export class GatewayError extends Error {
  constructor(readonly kind: 'UNAVAILABLE' | 'MALFORMED' | 'AUTHENTICATION' | 'MISMATCH') { super('Gateway operation unresolved'); }
}
/** SSLCommerz's documented MD5 notification protocol, not password storage or payment authority. */
export function verifyNotification(input: Record<string, unknown>, storePassword: string): 'absent' | 'verified' {
  if (input.verify_sign === undefined && input.verify_key === undefined) return 'absent';
  if (typeof input.verify_sign !== 'string' || !/^[a-f0-9]{32}$/i.test(input.verify_sign) || typeof input.verify_key !== 'string' || input.verify_key.length > 2000) throw new GatewayError('MISMATCH');
  const keys = input.verify_key.split(',');
  if (keys.length > 40 || new Set(keys).size !== keys.length || !['tran_id', 'amount', 'currency', 'status'].every(k => keys.includes(k))) throw new GatewayError('MISMATCH');
  const values: Record<string, string> = Object.create(null);
  for (const key of keys) {
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(key) || ['store_passwd', 'verify_key', 'verify_sign', '__proto__', 'constructor', 'prototype'].includes(key) || typeof input[key] !== 'string' || (input[key] as string).length > 4096) throw new GatewayError('MISMATCH');
    values[key] = input[key] as string;
  }
  values.store_passwd = createHash('md5').update(storePassword).digest('hex');
  const computed = createHash('md5').update(Object.keys(values).sort().map(k => `${k}=${values[k]}`).join('&')).digest();
  if (!timingSafeEqual(computed, Buffer.from(input.verify_sign, 'hex'))) throw new GatewayError('MISMATCH');
  return 'verified';
}
const text = z.string().min(1).max(100);
export type Evidence = { status: string; tranId: string; amountMinor: string; currency: string; valId?: string; bankId?: string; channel?: string; risk: boolean };
export type Session = { sessionKey: string; url: string; channels: string[] };
export type Customer = { name: string; email: string; phone: string; address: string; city: string; country: string; product: string };
export interface Gateway {
  initiate(tranId: string, amountMinor: string, customer: Customer): Promise<Session>;
  validate(valId: string): Promise<Evidence>;
  query(tranId: string): Promise<Evidence[]>;
  refund(bankId: string, refundId: string, amountMinor: string, reason: string): Promise<{ reference: string; tranId: string }>;
  refundStatus(reference: string): Promise<{ status: 'refunded' | 'processing' | 'cancelled'; bankId: string; tranId: string; amountMinor?: string }>;
}
export class SSLCommerzClient implements Gateway {
  constructor(private readonly config: GatewayConfig, private readonly transport: typeof fetch = fetch) {}
  private async call(path: string, fields: Record<string, string>, method: 'GET' | 'POST' = 'GET'): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ ...fields, store_id: this.config.storeId, store_passwd: this.config.password, format: 'json', v: '1' });
    const url = new URL(path, apiOrigin); if (method === 'GET') url.search = params.toString();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.transport(url, { method, redirect: 'error', signal: controller.signal, ...(method === 'POST' ? { body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } } : {}) });
      if (!response.ok || !response.body) throw new GatewayError('UNAVAILABLE');
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 131072) throw new GatewayError('MALFORMED'); chunks.push(value); } }
      finally { await reader.cancel().catch(() => {}); }
      let raw: unknown;
      try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new GatewayError('MALFORMED'); }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new GatewayError('MALFORMED');
      const record = raw as Record<string, unknown>;
      if (record.APIConnect && record.APIConnect !== 'DONE') throw new GatewayError('AUTHENTICATION');
      if (record.store_id !== undefined && record.store_id !== this.config.storeId) throw new GatewayError('MISMATCH');
      return record;
    } catch (e) { if (e instanceof GatewayError) throw e; throw new GatewayError('UNAVAILABLE'); }
    finally { clearTimeout(timer); }
  }
  async initiate(tranId: string, amountMinor: string, customer: Customer): Promise<Session> {
    const base = `${this.config.callbackOrigin}/api/v1/payments/sslcommerz`;
    const data = await this.call('/gwprocess/v4/api.php', { tran_id: tranId, total_amount: decimal(amountMinor), currency: 'BDT', success_url: `${base}/success`, fail_url: `${base}/fail`, cancel_url: `${base}/cancel`, ipn_url: `${base}/ipn`, cus_name: customer.name, cus_email: customer.email, cus_phone: customer.phone, cus_add1: customer.address, cus_city: customer.city, cus_country: customer.country, shipping_method: 'NO', num_of_item: '1', product_name: customer.product, product_category: 'Assisted travel booking', product_profile: 'non-physical-goods' }, 'POST');
    if (data.status !== 'SUCCESS') throw new GatewayError('AUTHENTICATION');
    const channels: string[] = []; // No multi_card_name: Hosted Checkout decides actual merchant-enabled channels.
    if (data.gw && typeof data.gw === 'object') for (const [key, value] of Object.entries(data.gw)) if (/^[a-z_]{1,40}$/i.test(key) && value) channels.push(key);
    try { return { sessionKey: z.string().min(1).max(100).parse(data.sessionkey), url: checkoutURL(data.GatewayPageURL), channels }; }
    catch { throw new GatewayError('MALFORMED'); }
  }
  private evidence(data: Record<string, unknown>): Evidence {
    try {
      const status = z.enum(['VALID', 'VALIDATED', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNATTEMPTED', 'PENDING']).parse(data.status);
      const amountMinor = minor(text.parse(data.amount)).toString();
      if (data.currency !== 'BDT' || data.currency_type !== undefined && data.currency_type !== 'BDT' || data.currency_amount !== undefined && minor(text.parse(data.currency_amount)).toString() !== amountMinor) throw Error();
      if (['VALID', 'VALIDATED'].includes(status) && (data.risk_level !== '0' && data.risk_level !== '1' && data.risk_level !== 0 && data.risk_level !== 1)) throw Error();
      return { status, tranId: text.parse(data.tran_id), amountMinor, currency: 'BDT', ...(data.val_id ? { valId: text.parse(data.val_id) } : {}), ...(data.bank_tran_id ? { bankId: text.parse(data.bank_tran_id) } : {}), ...(typeof data.card_type === 'string' && /^[A-Za-z][A-Za-z _/-]{0,79}$/.test(data.card_type) ? { channel: data.card_type } : {}), risk: String(data.risk_level) === '1' };
    } catch { throw new GatewayError('MALFORMED'); }
  }
  async validate(valId: string) {
    const r = await this.call('/validator/api/validationserverAPI.php', { val_id: text.parse(valId) });
    if (r.APIConnect !== 'DONE') throw new GatewayError('MALFORMED');
    return this.evidence(r);
  }
  async query(tranId: string) {
    const r = await this.call('/validator/api/merchantTransIDvalidationAPI.php', { tran_id: text.parse(tranId) });
    if (r.APIConnect !== 'DONE' || !Array.isArray(r.element) || r.element.length > 20) throw new GatewayError('MALFORMED');
    return r.element.map(v => this.evidence(z.record(z.string(), z.unknown()).parse(v)));
  }
  async refund(bankId: string, refundId: string, amountMinor: string, reason: string) {
    if (!this.config.refunds) throw AppError.forbidden('Refund execution is not approved');
    const r = await this.call('/validator/api/merchantTransIDvalidationAPI.php', { bank_tran_id: bankId, refund_trans_id: refundId, refund_amount: decimal(amountMinor), refund_remarks: reason });
    if (r.APIConnect !== 'DONE' || !['success', 'processing'].includes(String(r.status)) || r.bank_tran_id !== bankId) throw new GatewayError('MISMATCH');
    if (r.trans_id !== undefined && r.tran_id !== undefined && r.trans_id !== r.tran_id) throw new GatewayError('MISMATCH');
    return { reference: text.parse(r.refund_ref_id), tranId: text.parse(r.tran_id ?? r.trans_id) };
  }
  async refundStatus(reference: string) {
    const r = await this.call('/validator/api/merchantTransIDvalidationAPI.php', { refund_ref_id: reference });
    if (r.APIConnect !== 'DONE' || r.refund_ref_id !== reference) throw new GatewayError('MISMATCH');
    // The documented status response does not promise refund_amount; bind the stored initiation reference + original transaction.
    return { status: z.enum(['refunded', 'processing', 'cancelled']).parse(r.status), bankId: text.parse(r.bank_tran_id), tranId: text.parse(r.tran_id), ...(r.refund_amount === undefined ? {} : { amountMinor: minor(text.parse(r.refund_amount)).toString() }) };
  }
}
// Encrypt only allowlisted session metadata; never persist the merchant credentials or raw provider body.
export function sealSession(session: Session, id: string, key: Buffer): string {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(Buffer.from(`sslcommerz:sandbox:${id}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]); return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64');
}
export function openSession(value: string, id: string, key: Buffer): Session {
  try { const b = Buffer.from(value, 'base64'); if (b.length > 8192 || b.length < 29) throw Error(); const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); d.setAAD(Buffer.from(`sslcommerz:sandbox:${id}`)); d.setAuthTag(b.subarray(12, 28)); const r = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); return { sessionKey: text.parse(r.sessionKey), url: checkoutURL(r.url), channels: z.array(z.string().max(40)).max(30).parse(r.channels) }; }
  catch { throw AppError.internal('Payment session unavailable'); }
}
