import { Request, Response, NextFunction } from 'express';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import * as accountService from '../services/account.service.js';

function currentUserId(req: Request): string { return (req as AuthenticatedRequest).user!.id; }

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success(await accountService.getDashboard(currentUserId(req)))); } catch (error) { next(error); }
}

export async function listInquiries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success(await accountService.listInquiries(currentUserId(req), req.query as never))); } catch (error) { next(error); }
}

export async function getInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success(await accountService.getInquiry(currentUserId(req), req.params.type as never, req.params.reference))); } catch (error) { next(error); }
}

export async function listBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success(await accountService.listBookings(currentUserId(req), req.query as never))); } catch (error) { next(error); }
}

export async function getBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success({ booking: await accountService.getBooking(currentUserId(req), req.params.reference) })); } catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(success({ user: await accountService.updateProfile(currentUserId(req), req.body) }, 'Profile updated successfully')); } catch (error) { next(error); }
}
