import { env } from './config/env.js';
import { validateEnv } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';

async function startServer(): Promise<void> {
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`✈  FlyWithsafety API server running on port ${env.port}`);
    console.log(`   Environment: ${env.nodeEnv}`);
    console.log(`   Health: http://localhost:${env.port}/api/v1/health`);
    console.log(`   CORS origin: ${env.corsOrigin}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await prisma.$disconnect();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing database connection:', err);
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
    console.error('Uncaught Exception:', err);
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });
}

void startServer();