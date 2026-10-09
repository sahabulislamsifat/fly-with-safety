import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import destinationRoutes from './routes/destinations.routes.js';
import packageRoutes from './routes/packages.routes.js';
import flightRoutes from './routes/flights.routes.js';
import hotelRoutes from './routes/hotels.routes.js';
import visaRoutes from './routes/visa.routes.js';
import contactRoutes from './routes/contact.routes.js';
import testimonialRoutes from './routes/testimonials.routes.js';
import adminRoutes from './routes/admin.routes.js';
import airportsRoutes from './routes/airports.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import futureStubsRoutes from './routes/future-stubs.routes.js';

const app = express();

// Behind a reverse proxy in production: needed for correct req.ip (rate limiting)
if (env.nodeEnv === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');

// Request ID + request logging (must be first so every layer can read the ID)
app.use(requestId);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
}));

// Body parsing
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// API routes
const API_PREFIX = '/api/v1';

app.use(API_PREFIX, healthRoutes);
app.use(API_PREFIX, authRoutes);
app.use(API_PREFIX, destinationRoutes);
app.use(API_PREFIX, packageRoutes);
app.use(API_PREFIX, flightRoutes);
app.use(API_PREFIX, hotelRoutes);
app.use(API_PREFIX, visaRoutes);
app.use(API_PREFIX, contactRoutes);
app.use(API_PREFIX, testimonialRoutes);
app.use(API_PREFIX, adminRoutes);
app.use(API_PREFIX, airportsRoutes);
app.use(API_PREFIX, bookingRoutes);
app.use(API_PREFIX, futureStubsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;