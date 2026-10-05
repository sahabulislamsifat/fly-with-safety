import { Router } from 'express';
import * as packageController from '../controllers/package.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { packageInquirySchema } from '../validators/package.schemas.js';
import { env } from '../config/env.js';

const router = Router();

const inquiryRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 30,
  message: 'Too many inquiry submissions.',
});

router.get('/packages', packageController.getPackages);
router.get('/packages/:slug', packageController.getPackageBySlug);
// Spec route: package identified in the body (or general inquiry)
router.post(
  '/packages/inquiries',
  inquiryRateLimiter,
  optionalAuth,
  validate(packageInquirySchema),
  (req, _res, next) => {
    req.params.slug = req.body.packageSlug || 'general';
    next();
  },
  packageController.submitPackageInquiry
);
router.post(
  '/packages/:slug/inquiry',
  inquiryRateLimiter,
  optionalAuth,
  validate(packageInquirySchema),
  packageController.submitPackageInquiry
);

export default router;
