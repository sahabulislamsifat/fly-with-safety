import { Router as createRouter, type Router } from 'express';
import * as accountController from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate, validateParams, validateQuery } from '../middleware/validation.middleware.js';
import {
  bookingListQuerySchema,
  bookingParamsSchema,
  inquiryListQuerySchema,
  inquiryParamsSchema,
  updateProfileSchema,
} from '../validators/account.schemas.js';

const router: Router = createRouter();
router.use('/account', requireAuth, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/account/dashboard', accountController.getDashboard);
router.get(
  '/account/inquiries',
  validateQuery(inquiryListQuerySchema),
  accountController.listInquiries,
);
router.get(
  '/account/inquiries/:type/:reference',
  validateParams(inquiryParamsSchema),
  accountController.getInquiry,
);
router.get('/account/bookings', validateQuery(bookingListQuerySchema), accountController.listBookings);
router.get(
  '/account/bookings/:reference',
  validateParams(bookingParamsSchema),
  accountController.getBooking,
);
router.patch('/account/profile', validate(updateProfileSchema), accountController.updateProfile);

export default router;
