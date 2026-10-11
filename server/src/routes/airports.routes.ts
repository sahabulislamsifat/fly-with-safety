import { Router as createRouter, type Router } from 'express';
import { getAirports } from '../controllers/airport.controller.js';

const router: Router = createRouter();

router.get('/airports/search', getAirports);
router.get('/airports', getAirports);

export default router;
