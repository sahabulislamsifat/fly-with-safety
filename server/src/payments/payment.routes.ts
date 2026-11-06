import express, { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/errors.js';
import { billingSchema } from './payment-domain.js';
import { PaymentService } from './payment.service.js';
import { PrismaPaymentStore } from './payment-store.js';
import { gatewayConfig, paymentEnabled, SSLCommerzClient, verifyNotification } from './sslcommerz.js';

const reference = z.string().regex(/^[A-Z0-9-]{3,64}$/);
const providerId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const negativeNotice = z.enum(['FAILED', 'CANCELLED', 'EXPIRED', 'UNATTEMPTED']);
const refundInput = z.object({ requestId: z.uuid().transform(v => v.toLowerCase()), paymentId: z.uuid().transform(v => v.toLowerCase()), amountMinor: z.string().regex(/^[1-9][0-9]{0,9}$/), reason: z.string().trim().min(1).max(100) }).strict();
const run = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(e => next(e instanceof z.ZodError ? AppError.badRequest('Invalid payment request') : e)); };
const service = () => { const c = gatewayConfig(); return new PaymentService(new PrismaPaymentStore(), new SSLCommerzClient(c), c); };
const actor = (r: Request) => { const a = (r as AuthenticatedRequest).user; if (!a) throw AppError.unauthorized(); return a; };

export const paymentRoutes: Router = Router();
paymentRoutes.use('/payments', requireAuth, rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }), (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
paymentRoutes.get('/payments/capabilities', (_req, res) => res.json({ success: true, data: { enabled: paymentEnabled(), mode: 'sandbox' } }));
paymentRoutes.get('/payments/operations', run(async (req, res) => {
  if (!['STAFF', 'ADMIN'].includes(actor(req).role)) throw AppError.forbidden();
  res.json({ success: true, data: await service().operations(actor(req)) });
}));
paymentRoutes.get('/payments/bookings/:reference', run(async (req, res) => res.json({ success: true, data: await service().list(reference.parse(req.params.reference), actor(req)) })));
paymentRoutes.post('/payments/bookings/:reference/initiate', run(async (req, res) => {
  const input = billingSchema.parse(req.body);
  if (req.get('Idempotency-Key')?.toLowerCase() !== input.requestId) throw AppError.badRequest('Idempotency-Key must match requestId');
  res.status(202).json({ success: true, data: await service().initiate(reference.parse(req.params.reference), actor(req), input) });
}));
paymentRoutes.post('/payments/bookings/:reference/reconcile', run(async (req, res) => res.json({ success: true, data: await service().reconcile(reference.parse(req.params.reference), actor(req)) })));
paymentRoutes.post('/payments/reconciliation/run', run(async (req, res) => {
  if (actor(req).role !== 'ADMIN') throw AppError.forbidden();
  res.json({ success: true, data: await service().tick() });
}));
paymentRoutes.post('/payments/bookings/:reference/refunds', run(async (req, res) => {
  const input = refundInput.parse(req.body);
  if (req.get('Idempotency-Key')?.toLowerCase() !== input.requestId) throw AppError.badRequest('Idempotency-Key must match requestId');
  res.status(202).json({ success: true, data: await service().refund(reference.parse(req.params.reference), actor(req), input) });
}));

// Only these four provider POST paths bypass the browser Origin guard. No cookie-based authorization is used here.
export function createPaymentCallbacks(callbackService = service, callbackConfig = gatewayConfig): Router {
const paymentCallbacks: Router = Router();
const callbackLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
for (const source of ['success', 'fail', 'cancel', 'ipn']) {
  paymentCallbacks.post(`/payments/sslcommerz/${source}`, callbackLimit, express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }), run(async (req, res) => {
    if (!req.is('application/x-www-form-urlencoded')) throw AppError.badRequest('Expected provider form data');
    const tranId = providerId.parse(req.body?.tran_id);
    const valId = req.body?.val_id === undefined || req.body.val_id === '' ? undefined : providerId.parse(req.body.val_id);
    const c = callbackConfig(), s = callbackService();
    let signed = false;
    try { signed = verifyNotification(req.body, c.password) === 'verified'; } catch { throw AppError.badRequest('Invalid provider notification'); }
    if (req.body.store_id !== undefined && req.body.store_id !== c.storeId) throw AppError.badRequest('Invalid provider notification');
    const negative = negativeNotice.safeParse(req.body.status);
    const booking = signed && source === 'ipn' && negative.success
      ? await s.notify(tranId, valId, source, negative.data)
      : await s.notify(tranId, valId, source);
    // Durable notice first; then bounded authoritative validation, without holding a database lock over HTTP.
    // Provider outages remain scheduled for the explicit tick/manual recheck; acknowledgement is of the durable notice.
    await s.reconcile(booking, undefined, tranId);
    if (source === 'ipn') { res.status(200).type('text').send('RECEIVED'); return; }
    res.redirect(303, `${c.frontendOrigin}/payments/return?booking=${encodeURIComponent(booking)}`);
  }));
}

return paymentCallbacks;
}
export const paymentCallbacks: Router = createPaymentCallbacks();

/** Explicit owner-controlled worker entry point; not admitted automatically on normal development startup. */
export async function reconcileSandboxPayments() { return service().tick(); }
