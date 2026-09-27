import { Router, Request, Response } from 'express';
import { success } from '../utils/response.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json(
    success({
      status: 'ok',
      message: 'FlyWithSafe API is running',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    })
  );
});

export default router;