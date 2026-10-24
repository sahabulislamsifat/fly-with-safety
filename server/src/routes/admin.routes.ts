import { adminInquiryListQuerySchema } from '../validators/inquiry-query.schemas.js';
import { validateQuery } from '../middleware/validation.middleware.js';
import { Router as createRouter, type Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as contactController from '../controllers/contact.controller.js';
import * as testimonialController from '../controllers/testimonial.controller.js';
import * as flightService from '../services/flight.service.js';
import * as hotelService from '../services/hotel.service.js';
import * as packageService from '../services/package.service.js';
import * as visaService from '../services/visa.service.js';
import * as destinationService from '../services/destination.service.js';
import { success } from '../utils/response.js';
import { validate } from '../middleware/validation.middleware.js';
import { contactStatusSchema, inquiryStatusSchema } from '../validators/admin.schemas.js';
import * as bookingController from '../controllers/booking.controller.js';
import {
  updateBookingStatusSchema,
  createBookingFromInquirySchema,
} from '../validators/booking.schemas.js';
import * as outboxService from '../services/outbox.service.js';
import { AppError } from '../utils/errors.js';

const router: Router = createRouter();

// All admin routes require authentication AND ADMIN/STAFF role
router.use('/admin', requireAuth, requireRole('ADMIN', 'STAFF'));

// ─── Contact Messages ────────────────────────────────────────────────────────
router.get('/admin/contact', contactController.getContactMessages);
router.get('/admin/contact/:id', contactController.getContactMessageById);
router.patch(
  '/admin/contact/:id/status',
  validate(contactStatusSchema),
  contactController.updateContactStatus,
);

// ─── Testimonials ────────────────────────────────────────────────────────────
router.get('/admin/testimonials', testimonialController.adminGetTestimonials);
router.post('/admin/testimonials', testimonialController.createTestimonial);
router.patch('/admin/testimonials/:id/status', testimonialController.updateTestimonialStatus);
router.delete('/admin/testimonials/:id', testimonialController.deleteTestimonial);

// ─── Flight Inquiries ────────────────────────────────────────────────────────
router.get('/admin/inquiries/flights', validateQuery(adminInquiryListQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await flightService.getFlightInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/admin/inquiries/flights/:id/status',
  validate(inquiryStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inquiry = await flightService.updateFlightInquiryStatus(req.params.id, req.body.status);
      res.json(success({ inquiry }));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Hotel Inquiries ─────────────────────────────────────────────────────────
router.get('/admin/inquiries/hotels', validateQuery(adminInquiryListQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await hotelService.getHotelInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/admin/inquiries/hotels/:id/status',
  validate(inquiryStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inquiry = await hotelService.updateHotelInquiryStatus(req.params.id, req.body.status);
      res.json(success({ inquiry }));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Package Inquiries ────────────────────────────────────────────────────────
router.get('/admin/inquiries/packages', validateQuery(adminInquiryListQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await packageService.getPackageInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/admin/inquiries/packages/:id/status',
  validate(inquiryStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inquiry = await packageService.updatePackageInquiryStatus(
        req.params.id,
        req.body.status,
      );
      res.json(success({ inquiry }));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Visa Inquiries ───────────────────────────────────────────────────────────
router.get('/admin/inquiries/visa', validateQuery(adminInquiryListQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await visaService.getVisaInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/admin/inquiries/visa/:id/status',
  validate(inquiryStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inquiry = await visaService.updateVisaInquiryStatus(req.params.id, req.body.status);
      res.json(success({ inquiry }));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Destinations ─────────────────────────────────────────────────────────────
router.get('/admin/destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await destinationService.adminGetAllDestinations({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = await destinationService.createDestination(req.body);
    res.status(201).json(success({ destination }));
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/destinations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = await destinationService.updateDestination(req.params.id, req.body);
    res.json(success({ destination }));
  } catch (err) {
    next(err);
  }
});

// ─── Packages ─────────────────────────────────────────────────────────────────
router.get('/admin/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await packageService.adminGetAllPackages({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

// ─── Visa Info ────────────────────────────────────────────────────────────────
router.get('/admin/visa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await visaService.adminGetAllVisaInfo({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

// ─── Bookings ─────────────────────────────────────────────────────────────────
router.get('/admin/bookings', bookingController.adminGetBookings);
router.post(
  '/admin/bookings/from-inquiry',
  validate(createBookingFromInquirySchema),
  bookingController.adminCreateBookingFromInquiry,
);
router.patch(
  '/admin/bookings/:id/status',
  validate(updateBookingStatusSchema),
  bookingController.adminUpdateBookingStatus,
);

// ─── Notification Outbox Observability & Redrive ─────────────────────────────
router.get('/admin/outbox', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await outboxService.getOutboxStats();
    res.json(success({ outbox: stats }));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/admin/outbox/:id/redrive',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redriven = await outboxService.redriveFailedNotification(req.params.id);
      if (!redriven) {
        throw AppError.notFound('Notification record not found or not in FAILED status');
      }
      res.json(
        success({ id: req.params.id, status: 'PENDING' }, 'Notification queued for redrive'),
      );
    } catch (err) {
      next(err);
    }
  },
);

export default router;
