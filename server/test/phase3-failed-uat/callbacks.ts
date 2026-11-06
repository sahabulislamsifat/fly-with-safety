import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../src/utils/errors.js';
import { verifyNotification, type GatewayConfig } from '../../src/payments/sslcommerz.js';
import type { PaymentService } from '../../src/payments/payment.service.js';

/** Only mounted behind the existing isolated admission and owned-transaction guards. */
export function failedCallbacks(service: PaymentService, config: GatewayConfig, limiter: RequestHandler) {
  const router = Router();
  const providerId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
  for (const source of ['fail', 'ipn'] as const) {
    router.post(`/payments/sslcommerz/${source}`, limiter, express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }), (req, res, next) => {
      void (async () => {
        if (!req.is('application/x-www-form-urlencoded')) throw AppError.badRequest('Expected provider form data');
        const tranId = providerId.parse(req.body?.tran_id);
        const valId = req.body?.val_id === undefined || req.body.val_id === '' ? undefined : providerId.parse(req.body.val_id);
        let signed: boolean;
        try { signed = verifyNotification(req.body, config.password) === 'verified'; }
        catch { throw AppError.badRequest('Invalid provider notification'); }
        if (req.body.store_id !== undefined && req.body.store_id !== config.storeId) throw AppError.badRequest('Invalid provider notification');
        if (source === 'ipn' && (!signed || req.body.status !== 'FAILED')) throw AppError.badRequest('Expected a signed FAILED notification');
        const booking = source === 'ipn' ? await service.notify(tranId, valId, source, 'FAILED') : await service.notify(tranId, valId, source);
        await service.reconcile(booking, undefined, tranId);
        if (source === 'ipn') { res.status(200).type('text').send('RECEIVED'); return; }
        res.redirect(303, `${config.frontendOrigin}/payments/return?booking=${encodeURIComponent(booking)}`);
      })().catch(e => next(e instanceof z.ZodError ? AppError.badRequest('Invalid payment request') : e));
    });
  }
  return router;
}
