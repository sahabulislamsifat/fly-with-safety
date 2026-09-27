import { Router } from 'express';
import * as flightController from '../controllers/flight.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { flightSearchSchema, flightInquirySchema } from '../validators/flight.schemas.js';
import { env } from '../config/env.js';

const router = Router();

const inquiryRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 30,
  message: 'Too many inquiry submissions.',
});

router.post('/flights/search', validate(flightSearchSchema), flightController.searchFlights);
router.post('/flights/inquiry', inquiryRateLimiter, optionalAuth, validate(flightInquirySchema), flightController.submitFlightInquiry);

export default router;
