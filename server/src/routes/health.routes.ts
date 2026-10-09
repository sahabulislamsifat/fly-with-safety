import { Router, Request, Response } from 'express';
import { success } from '../utils/response.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

async function checkDatabase(): Promise<'up' | 'down'> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    return 'up';
  } catch {
    return 'down';
  }
}

// safety diagnostics only: no URLs, versions of secrets, or error details.
router.get('/health', async (_req: Request, res: Response) => {
  const database = await checkDatabase();
  res.json(
    success({
      status: database === 'up' ? 'ok' : 'degraded',
      message: 'FlyWithsafety API is running',
      environment: env.nodeEnv,
      database,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    })
  );
});

export default router;