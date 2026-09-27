import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as contactController from '../controllers/contact.controller.js';
import * as testimonialController from '../controllers/testimonial.controller.js';
import * as flightService from '../services/flight.service.js';
import * as hotelService from '../services/hotel.service.js';
import * as packageService from '../services/package.service.js';
import * as visaService from '../services/visa.service.js';
import * as destinationService from '../services/destination.service.js';
import { success } from '../utils/response.js';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// All admin routes require authentication AND ADMIN/STAFF role
router.use(requireAuth);
router.use(requireRole('ADMIN', 'STAFF'));

// ─── Contact Messages ────────────────────────────────────────────────────────
router.get('/admin/contact', contactController.getContactMessages);
router.get('/admin/contact/:id', contactController.getContactMessageById);
router.patch('/admin/contact/:id/status', contactController.updateContactStatus);

// ─── Testimonials ────────────────────────────────────────────────────────────
router.get('/admin/testimonials', testimonialController.adminGetTestimonials);
router.post('/admin/testimonials', testimonialController.createTestimonial);
router.patch('/admin/testimonials/:id/status', testimonialController.updateTestimonialStatus);
router.delete('/admin/testimonials/:id', testimonialController.deleteTestimonial);

// ─── Flight Inquiries ────────────────────────────────────────────────────────
router.get('/admin/inquiries/flights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await flightService.getFlightInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

router.patch('/admin/inquiries/flights/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await flightService.updateFlightInquiryStatus(req.params.id, req.body.status);
    res.json(success({ inquiry }));
  } catch (err) { next(err); }
});

// ─── Hotel Inquiries ─────────────────────────────────────────────────────────
router.get('/admin/inquiries/hotels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await hotelService.getHotelInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

router.patch('/admin/inquiries/hotels/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await hotelService.updateHotelInquiryStatus(req.params.id, req.body.status);
    res.json(success({ inquiry }));
  } catch (err) { next(err); }
});

// ─── Package Inquiries ────────────────────────────────────────────────────────
router.get('/admin/inquiries/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await packageService.getPackageInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

router.patch('/admin/inquiries/packages/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await packageService.updatePackageInquiryStatus(req.params.id, req.body.status);
    res.json(success({ inquiry }));
  } catch (err) { next(err); }
});

// ─── Visa Inquiries ───────────────────────────────────────────────────────────
router.get('/admin/inquiries/visa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await visaService.getVisaInquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string | undefined,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

router.patch('/admin/inquiries/visa/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await visaService.updateVisaInquiryStatus(req.params.id, req.body.status);
    res.json(success({ inquiry }));
  } catch (err) { next(err); }
});

// ─── Destinations ─────────────────────────────────────────────────────────────
router.get('/admin/destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await destinationService.adminGetAllDestinations({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

router.post('/admin/destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = await destinationService.createDestination(req.body);
    res.status(201).json(success({ destination }));
  } catch (err) { next(err); }
});

router.patch('/admin/destinations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = await destinationService.updateDestination(req.params.id, req.body);
    res.json(success({ destination }));
  } catch (err) { next(err); }
});

// ─── Packages ─────────────────────────────────────────────────────────────────
router.get('/admin/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await packageService.adminGetAllPackages({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

// ─── Visa Info ────────────────────────────────────────────────────────────────
router.get('/admin/visa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await visaService.adminGetAllVisaInfo({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json(success(result));
  } catch (err) { next(err); }
});

export default router;
