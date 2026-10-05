import { Router } from 'express';
import { getAirports } from '../controllers/airport.controller.js';

const router = Router();

router.get('/airports/search', getAirports);
router.get('/airports', getAirports);

export default router;
