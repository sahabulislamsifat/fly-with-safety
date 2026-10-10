import { Request, Response, NextFunction } from 'express';
import * as packageService from '../services/package.service.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function getPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const destinationSlug = req.query.destination as string | undefined;
    const featured = req.query.featured === 'true';
    const result = await packageService.getPublicPackages({ page, limit, destinationSlug, featured });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getPackageBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pkg = await packageService.getPackageBySlug(req.params.slug);
    res.json(success({ package: pkg }));
  } catch (err) {
    next(err);
  }
}

export async function submitPackageInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const result = await packageService.submitPackageInquiry(req.params.slug, req.body, userId, req.idempotencyKey!);
    res.status(201).json(success({
      referenceNumber: result.inquiry.referenceNumber,
      inquiry: result.inquiry,
      message: 'Package inquiry submitted. Our team will contact you shortly.',
    }, result.replayed ? 'Original package inquiry returned' : undefined));
  } catch (err) {
    next(err);
  }
}
