import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { changeBookingCommercial } from '../services/booking-commercial.service.js';
import { bookingDTO } from '../utils/booking-dto.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export async function changeCommercial(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw AppError.unauthorized();
    const booking = await changeBookingCommercial(req.params.reference, user, req.body);
    res.set('Cache-Control', 'no-store').json(success({ booking: bookingDTO(booking, user.role === 'CUSTOMER' ? 'customer' : 'admin') }));
  } catch (error) { next(error); }
}
