import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

export const env = {
  // Server
  port: getEnvNumber('PORT', 5000),
  nodeEnv: getEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',

  // CORS
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),

  // Database
  databaseUrl: getEnv('DATABASE_URL', ''),
  directUrl: getEnv('DIRECT_URL', ''),

  // JWT
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret-change-in-production'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),

  // Rate limiting
  rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMax: getEnvNumber('RATE_LIMIT_MAX', 100),
  authRateLimitWindowMs: getEnvNumber('AUTH_RATE_LIMIT_WINDOW_MS', 900000),
  authRateLimitMax: getEnvNumber('AUTH_RATE_LIMIT_MAX', 10),

  // SMTP
  smtpHost: getEnv('SMTP_HOST', ''),
  smtpPort: getEnvNumber('SMTP_PORT', 587),
  smtpSecure: getEnvBool('SMTP_SECURE', false),
  smtpUser: getEnv('SMTP_USER', ''),
  smtpPassword: getEnv('SMTP_PASSWORD', ''),
  smtpEmailFrom: getEnv('SMTP_EMAIL_FROM', ''),
  smtpEmailFromName: getEnv('SMTP_EMAIL_FROM_NAME', 'FlyWithSafe'),
  smtpService: getEnv('SMTP_SERVICE', ''),

  // Google OAuth
  googleClientId: getEnv('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
  googleCallbackUrl: getEnv('GOOGLE_CALLBACK_URL', 'http://localhost:5000/api/v1/auth/google/callback'),

  // Stripe
  stripePublishableKey: getEnv('STRIPE_PUBLISHABLE_KEY', ''),
  stripeSecretKey: getEnv('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET', ''),

  // Admin seed
  adminEmail: getEnv('ADMIN_EMAIL', ''),
  adminPassword: getEnv('ADMIN_PASSWORD', ''),

  // Frontend URL
  frontendUrl: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
};

export type Env = typeof env;

export function validateEnv(): void {
  const problems: string[] = [];

  if (!['development', 'production', 'test'].includes(env.nodeEnv)) {
    problems.push(`Invalid NODE_ENV: ${env.nodeEnv}`);
  }
  if (env.port < 1 || env.port > 65535) {
    problems.push(`Invalid PORT: ${env.port}`);
  }
  try {
    new URL(env.corsOrigin);
  } catch {
    problems.push(`Invalid CORS_ORIGIN: ${env.corsOrigin}`);
  }
  if (env.nodeEnv !== 'test' && !env.databaseUrl) {
    problems.push('DATABASE_URL is required');
  }
  if (env.nodeEnv === 'production') {
    if (env.jwtSecret === 'dev-secret-change-in-production' || env.jwtSecret.length < 32) {
      problems.push('JWT_SECRET must be set to a random value of at least 32 characters in production');
    }
  }

  if (problems.length > 0) {
    throw new Error(`Environment validation failed:\n - ${problems.join('\n - ')}`);
  }
}
