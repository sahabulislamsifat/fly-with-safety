import { Router as createRouter, type Router } from 'express';
import * as visaController from '../controllers/visa.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { visaInquirySchema } from '../validators/visa.schemas.js';
import { env } from '../config/env.js';

const router: Router = createRouter();

const inquiryRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 30,
  message: 'Too many inquiry submissions.',
});

router.get('/visa', visaController.getVisaList);
router.get('/visa/:country', visaController.getVisaByCountry);
router.post(
  '/visa/inquiries',
  inquiryRateLimiter,
  optionalAuth,
  validate(visaInquirySchema),
  requireIdempotencyKey,
  visaController.submitVisaInquiry,
);
router.post(
  '/visa/inquiry',
  inquiryRateLimiter,
  optionalAuth,
  validate(visaInquirySchema),
  requireIdempotencyKey,
  visaController.submitVisaInquiry,
);

export default router;
