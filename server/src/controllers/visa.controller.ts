import { Request, Response, NextFunction } from 'express';
import * as visaService from '../services/visa.service.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function getVisaList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await visaService.getPublicVisaInfoList({ page, limit });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getVisaByCountry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const visa = await visaService.getVisaInfoByCountry(req.params.country);
    res.json(success({ visa }));
  } catch (err) {
    next(err);
  }
}

export async function submitVisaInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const result = await visaService.submitVisaInquiry(req.body, userId);
    res.status(201).json(success({
      referenceNumber: result.referenceNumber,
      inquiry: result,
      message: 'Visa inquiry submitted. Our specialists will contact you shortly.',
    }));
  } catch (err) {
    next(err);
  }
}
