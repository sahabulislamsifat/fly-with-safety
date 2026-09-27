import { Request, Response, NextFunction } from 'express';
import * as hotelService from '../services/hotel.service.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function searchHotels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await hotelService.searchHotels(req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function submitHotelInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const result = await hotelService.submitHotelInquiry(req.body, userId);
    res.status(201).json(success({
      referenceNumber: result.referenceNumber,
      inquiry: result,
      message: 'Hotel inquiry submitted. Our team will contact you with options shortly.',
    }));
  } catch (err) {
    next(err);
  }
}
