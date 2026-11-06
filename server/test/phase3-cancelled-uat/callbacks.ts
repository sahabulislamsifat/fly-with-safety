import express, { Router, type RequestHandler } from 'express';
import { minor, verifyNotification, type GatewayConfig } from '../../src/payments/sslcommerz.js';
import type { PaymentService } from '../../src/payments/payment.service.js';

type Source = 'cancel' | 'ipn';
const routes = ['success', 'fail', 'cancel', 'ipn'] as const;
export function callbackRoute(url: string) {
  return routes.find(route => url === `/api/v1/payments/sslcommerz/${route}`) ?? 'OTHER';
}
export function isCancelledCaseRoute(route: ReturnType<typeof callbackRoute>): route is Source {
  return route === 'cancel' || route === 'ipn';
}
export class FirstStop {
  code?: string;
  set(code: string) { if (this.code) return false; this.code = code; return true; }
}
export class WireBudget {
  count = 0;
  constructor(private readonly limit: number) {}
  admit() { if (this.count >= this.limit) return false; this.count++; return true; }
}

type Options = {
  lookup: (tranId: string) => { fixture: { amount: number } } | undefined;
  reserve: () => void;
  rejected: () => void;
  record: (event: object) => void;
  track: (task: Promise<unknown>) => void;
  terminal: (source: Source, valId: string | undefined) => void;
  acknowledged: (source: Source) => void;
  stop: (code: string) => void;
};

export function cancelledCallbacks(service: Pick<PaymentService, 'notify' | 'reconcile'>, config: GatewayConfig, limiter: RequestHandler, options: Options) {
  const router = Router();
  const seen = new Map<Source, { valId: string | undefined; bankId: string | undefined; work: Promise<string> }>();
  const id = /^[A-Za-z0-9_-]{1,100}$/;
  for (const route of ['cancel', 'ipn'] as const) {
    router.post(`/payments/sslcommerz/${route}`, limiter, express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }), (req, res, next) => {
      void (async () => {
        const reject = (reason: string, status = 400) => {
          options.record({ kind: 'callback-rejected', route, reason });
          options.rejected();
          res.status(status).end();
        };
        const body = req.body;
        if (!req.is('application/x-www-form-urlencoded') || !body || typeof body.tran_id !== 'string' || !id.test(body.tran_id)) return reject('FORM_IDENTITY');
        const tranId = body.tran_id;
        const owned = options.lookup(tranId);
        if (!owned) return reject('UNOWNED_TRANSACTION', 404);
        try { if (verifyNotification(body, config.password) !== 'verified') return reject('SIGNATURE_ABSENT'); }
        catch { return reject('SIGNATURE_INVALID'); }
        const signedKeys = body.verify_key.split(',') as string[];
        const valId = signedKeys.includes('val_id') && body.val_id !== '' ? body.val_id : undefined;
        const bankId = signedKeys.includes('bank_tran_id') && body.bank_tran_id !== '' ? body.bank_tran_id : undefined;
        if ([valId, bankId].some(value => value !== undefined && (typeof value !== 'string' || !id.test(value)))) return reject('ATTEMPT_ID_FORMAT');
        if (body.store_id !== undefined && body.store_id !== config.storeId) return reject('STORE_MISMATCH');
        if (body.status !== 'CANCELLED') { options.stop('UNEXPECTED_SIGNED_CALLBACK_OUTCOME'); return reject('UNEXPECTED_SIGNED_STATUS'); }
        let amount: bigint;
        try { if (typeof body.amount !== 'string') return reject('AMOUNT_FORMAT'); amount = minor(body.amount); }
        catch { return reject('AMOUNT_FORMAT'); }
        if (amount !== BigInt(owned.fixture.amount * 100) || body.currency !== 'BDT') {
          options.stop('SIGNED_CALLBACK_FINANCIAL_MISMATCH'); return reject('AMOUNT_OR_CURRENCY_MISMATCH');
        }
        const prior = seen.get(route);
        const other = seen.get(route === 'cancel' ? 'ipn' : 'cancel');
        if ((prior && (prior.valId !== valId || prior.bankId !== bankId)) ||
            (other && ((other.valId && valId && other.valId !== valId) || (other.bankId && bankId && other.bankId !== bankId)))) {
          options.stop('SECOND_DISTINCT_CALLBACK_ATTEMPT'); return reject('DISTINCT_SIGNED_ATTEMPT', 409);
        }
        let work = prior?.work;
        if (!work) {
          options.reserve();
          options.terminal(route, valId);
          work = (async () => {
            const booking = await service.notify(tranId, valId, route, route === 'ipn' ? 'CANCELLED' : undefined);
            await service.reconcile(booking, undefined, tranId);
            return booking;
          })();
          seen.set(route, { valId, bankId, work });
          options.track(work);
        }
        const booking = await work;
        res.once('finish', () => {
          options.record({ kind: 'callback-acknowledged', route, duplicate: !!prior, signed: true, status: res.statusCode });
          options.acknowledged(route);
        });
        if (route === 'ipn') { res.status(200).type('text').send('RECEIVED'); return; }
        res.redirect(303, `${config.frontendOrigin}/payments/return?booking=${encodeURIComponent(booking)}`);
      })().catch(next);
    });
  }
  return router;
}
