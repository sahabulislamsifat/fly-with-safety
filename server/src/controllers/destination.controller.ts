import { Request, Response, NextFunction } from 'express';
import * as destinationService from '../services/destination.service.js';
import { success } from '../utils/response.js';

export async function getDestinations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const featured = req.query.featured === 'true';
    const result = await destinationService.getPublicDestinations({ page, limit, featured });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getDestinationBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const destination = await destinationService.getDestinationBySlug(req.params.slug);
    res.json(success({ destination }));
  } catch (err) {
    next(err);
  }
}
