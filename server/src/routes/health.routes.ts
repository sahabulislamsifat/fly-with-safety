import { Router, Request, Response } from 'express';
import { success } from '../utils/response';
import { env } from '../config/env';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json(
    success({
      status: 'ok',
      message: 'FlyWithSafe API is running',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  );
});

export default router;