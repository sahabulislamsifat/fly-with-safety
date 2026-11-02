import { logger } from './lib/logger.js';
import { env } from './config/env.js';
import { validateEnv } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { startOutboxWorker, stopOutboxWorker } from './services/outbox.service.js';
import { isGoogleStrategyConfigured } from './config/passport.js';

async function startServer(): Promise<void> {
  try {
    validateEnv();
  } catch (error) {
    logger.error('Environment validation failed');
    process.exit(1);
  }

  // Local development may poll. Serverless/production execution requires the protected trigger.
  if (env.nodeEnv === 'development' && !process.env.VERCEL && !process.argv.includes('--no-outbox-worker')) {
    startOutboxWorker(15000);
    console.log('   Outbox: Background notification worker initialized (15s poll)');
  }

  const server = app.listen(env.port, () => {
    console.log(`✈  FlyWithsafety API server running on port ${env.port}`);
    console.log(`   Environment: ${env.nodeEnv}`);
    console.log(`   Health: http://localhost:${env.port}/api/v1/health`);
    console.log(`   CORS origin: ${env.corsOrigin}`);
    console.log(`   Google OAuth: ${isGoogleStrategyConfigured() ? 'Configured' : 'Disabled (credentials missing)'}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    stopOutboxWorker();
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await prisma.$disconnect();
        console.log('Database connection closed.');
      } catch (err) {
        logger.error('Error closing database connection');
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception');
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection');
  });
}

void startServer();
