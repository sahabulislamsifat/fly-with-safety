import { Router as createRouter, type Router } from 'express';
import * as destinationController from '../controllers/destination.controller.js';

const router: Router = createRouter();

router.get('/destinations', destinationController.getDestinations);
router.get('/destinations/:slug', destinationController.getDestinationBySlug);

export default router;
