import { Request, Response, NextFunction } from 'express';
import * as flightService from '../services/flight.service.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function searchFlights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await flightService.searchFlights(req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function submitFlightInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const result = await flightService.submitFlightInquiry(req.body, userId, req.idempotencyKey!);
    res.status(201).json(success({
      referenceNumber: result.inquiry.referenceNumber,
      inquiry: result.inquiry,
      message: 'Flight inquiry submitted. Our team will contact you with options shortly.',
    }, result.replayed ? 'Original flight inquiry returned' : undefined));
  } catch (err) {
    next(err);
  }
}
