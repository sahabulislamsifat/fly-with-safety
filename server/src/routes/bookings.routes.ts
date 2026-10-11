import { Router as createRouter, type Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { createBookingSchema, lookupBookingSchema } from '../validators/booking.schemas.js';
import { env } from '../config/env.js';

const router: Router = createRouter();

const bookingRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 30,
  message: 'Too many booking requests. Please try again later.',
});

router.post(
  '/bookings',
  bookingRateLimiter,
  optionalAuth,
  validate(createBookingSchema),
  bookingController.createBooking,
);
router.post(
  '/bookings/lookup',
  bookingRateLimiter,
  validate(lookupBookingSchema),
  bookingController.lookupBooking,
);

// Convenient GET lookup with email in query parameter
router.get('/bookings/:reference', bookingRateLimiter, (req, res, next) => {
  req.body = {
    referenceNumber: req.params.reference,
    email: req.query.email as string,
  };
  validate(lookupBookingSchema)(req, res, () => bookingController.lookupBooking(req, res, next));
});

export default router;
