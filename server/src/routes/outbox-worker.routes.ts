import { createHash, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import { processOutboxBatch } from '../services/outbox.service.js';
import { logger } from '../lib/logger.js';

const router: Router = Router();
// Vercel Cron uses GET. This is an authenticated command, never a cacheable public read.
router.get('/internal/outbox/run', async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const secret = process.env.CRON_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
    res.status(503).json({ success: false, code: 'WORKER_UNAVAILABLE' }); return;
  }
  const supplied = req.get('Authorization') || '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) {
    res.status(401).json({ success: false, code: 'UNAUTHORIZED' }); return;
  }
  // Browser cookies and browser-origin requests are not scheduler credentials.
  if (req.get('Cookie') !== undefined || req.get('Origin') !== undefined || req.get('Sec-Fetch-Site') !== undefined) {
    res.status(403).json({ success: false, code: 'FORBIDDEN' }); return;
  }
  if (process.env.OUTBOX_WORKER_ENABLED !== 'true') {
    res.status(503).json({ success: false, code: 'WORKER_DISABLED' }); return;
  }
  try {
    // Fixed limits cannot be overridden through query strings or request bodies.
    const result = await processOutboxBatch(3, { timeBudgetMs: 20_000, throwOnError: true });
    logger.info('outbox_worker_completed', result);
    res.json({ success: true, data: result });
  } catch {
    // Never log SMTP errors, recipient addresses, credentials, or request headers here.
    logger.warn('outbox_worker_failed', { reason: 'processing_unavailable' });
    res.status(503).json({ success: false, code: 'WORKER_UNAVAILABLE' });
  }
});
export default router;
