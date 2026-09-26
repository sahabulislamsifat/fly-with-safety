import { env } from './config/env';
import { validateEnv } from './config/env';
import app from './app';

function startServer(): void {
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`FlyWithSafe API server running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();