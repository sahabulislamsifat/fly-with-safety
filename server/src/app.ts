import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { rateLimiter } from './middleware/rate-limit';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const generalRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});

app.use('/api', generalRateLimit);

app.use('/api', healthRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;