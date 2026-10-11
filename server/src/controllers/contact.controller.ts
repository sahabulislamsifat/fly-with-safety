import { Request, Response, NextFunction } from 'express';
import * as contactService from '../services/contact.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export async function submitContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contactService.submitContact(req.body, req.idempotencyKey!);
    res.status(201).json(success({
      referenceNumber: result.inquiry.referenceNumber,
      message: 'Your message has been received. We will get back to you within 24 hours.',
    }, result.replayed ? 'Original contact message returned' : undefined));
  } catch (err) {
    next(err);
  }
}

export async function getContactMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const result = await contactService.getContactMessages({ page, limit, status });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getContactMessageById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = await contactService.getContactMessageById(req.params.id);
    if (!message) {
      next(AppError.notFound('Message not found'));
      return;
    }
    res.json(success({ message }));
  } catch (err) {
    next(err);
  }
}

export async function updateContactStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = await contactService.updateContactStatus(req.params.id, req.body.status);
    res.json(success({ message }));
  } catch (err) {
    next(err);
  }
}
