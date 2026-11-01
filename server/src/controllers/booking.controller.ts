import { bookingDTO } from '../utils/booking-dto.js';
import { Request, Response, NextFunction } from 'express';
import * as bookingService from '../services/booking.service.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const headerIdempotencyKey = req.header('x-idempotency-key') || req.header('idempotency-key');
    const booking = await bookingService.createBooking(req.body, userId, headerIdempotencyKey);
    res.set('Cache-Control', 'no-store').status(201).json(
      success(
        {
          booking: {
            id: booking.id,
            referenceNumber: booking.referenceNumber,
            status: booking.status,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            totalPrice: booking.totalPrice,
            currency: booking.currency,
            passengerCount: booking.passengers.length,
            createdAt: booking.createdAt,
          },
        },
        'Booking request submitted successfully'
      )
    );
  } catch (err) {
    next(err);
  }
}

export async function lookupBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.lookupBooking(req.body);
    res.set('Cache-Control', 'no-store').json(success({ booking: bookingDTO(booking, 'guest') }));
  } catch (err) {
    next(err);
  }
}

export async function adminGetBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;

    const result = await bookingService.adminGetBookings({ page, limit, status, type });
    res.set('Cache-Control', 'no-store').json(success({ ...result, bookings: result.bookings.map(b => bookingDTO(b, 'admin')) }));
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateBookingStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const staffId = authUser?.email || authUser?.id || 'STAFF';
    const booking = await bookingService.updateBookingStatus(
      req.params.id,
      req.body.status,
      req.body.reason,
      staffId,
      { status: req.body.expectedStatus, updatedAt: req.body.expectedUpdatedAt }
    );
    res.set('Cache-Control', 'no-store').json(success({ booking: booking ? bookingDTO(booking, 'admin') : null }, 'Booking status updated successfully'));
  } catch (err) {
    next(err);
  }
}

export async function adminCreateBookingFromInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const staffId = authUser?.email || authUser?.id || 'STAFF';
    const booking = await bookingService.createBookingFromInquiry(req.body, staffId);
    res.set('Cache-Control', 'no-store').status(201).json(success({ booking: bookingDTO(booking, 'admin') }, 'Booking created from inquiry successfully'));
  } catch (err) {
    next(err);
  }
}
