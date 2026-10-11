import { Router as createRouter, type Router } from 'express';
import * as contactController from '../controllers/contact.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { contactSchema } from '../validators/contact.schemas.js';
import { env } from '../config/env.js';

const router: Router = createRouter();

const contactRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 20, // Stricter for contact form
  message: 'Too many contact submissions. Please try again later.',
});

router.post(
  '/contact',
  contactRateLimiter,
  validate(contactSchema),
  requireIdempotencyKey,
  contactController.submitContact,
);

export default router;
