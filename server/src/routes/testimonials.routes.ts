import { Router as createRouter, type Router } from 'express';
import * as testimonialController from '../controllers/testimonial.controller.js';

const router: Router = createRouter();

router.get('/testimonials', testimonialController.getApprovedTestimonials);

export default router;
