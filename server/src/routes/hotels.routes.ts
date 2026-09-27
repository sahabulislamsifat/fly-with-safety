import { Router } from 'express';
import * as hotelController from '../controllers/hotel.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { hotelSearchSchema, hotelInquirySchema } from '../validators/hotel.schemas.js';
import { env } from '../config/env.js';

const router = Router();

const inquiryRateLimiter = rateLimiter({
  windowMs: env.rateLimitWindowMs,
  maxRequests: 30,
  message: 'Too many inquiry submissions.',
});

router.post('/hotels/search', validate(hotelSearchSchema), hotelController.searchHotels);
router.post('/hotels/inquiry', inquiryRateLimiter, optionalAuth, validate(hotelInquirySchema), hotelController.submitHotelInquiry);

export default router;
