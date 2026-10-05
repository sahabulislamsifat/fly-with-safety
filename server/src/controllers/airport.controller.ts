import { Request, Response, NextFunction } from 'express';
import { searchAirports } from '../services/airport.service.js';
import { success } from '../utils/response.js';

export async function getAirports(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const airports = searchAirports(q, limit);
    res.json(success({ airports }));
  } catch (err) {
    next(err);
  }
}
