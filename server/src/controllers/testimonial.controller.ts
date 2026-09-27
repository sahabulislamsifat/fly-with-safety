import { Request, Response, NextFunction } from 'express';
import * as testimonialService from '../services/testimonial.service.js';
import { success } from '../utils/response.js';

export async function getApprovedTestimonials(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testimonials = await testimonialService.getApprovedTestimonials();
    res.json(success({ testimonials }));
  } catch (err) {
    next(err);
  }
}

export async function adminGetTestimonials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const result = await testimonialService.adminGetAllTestimonials({ page, limit, status });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function createTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testimonial = await testimonialService.createTestimonial(req.body);
    res.status(201).json(success({ testimonial }));
  } catch (err) {
    next(err);
  }
}

export async function updateTestimonialStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body;
    const testimonial = await testimonialService.updateTestimonialStatus(
      req.params.id,
      status as 'APPROVED' | 'REJECTED' | 'PENDING'
    );
    res.json(success({ testimonial }));
  } catch (err) {
    next(err);
  }
}

export async function deleteTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await testimonialService.deleteTestimonial(req.params.id);
    res.json(success({ message: 'Testimonial deleted' }));
  } catch (err) {
    next(err);
  }
}
