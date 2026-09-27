import { Router } from 'express';
import * as destinationController from '../controllers/destination.controller.js';

const router = Router();

router.get('/destinations', destinationController.getDestinations);
router.get('/destinations/:slug', destinationController.getDestinationBySlug);

export default router;
