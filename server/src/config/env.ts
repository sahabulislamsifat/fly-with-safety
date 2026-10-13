import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Candidate .env file locations (current working dir, server dir, monorepo root)
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(currentDir, '../../.env'),
  path.resolve(currentDir, '../../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
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
  corsOrigin: getEnv('CORS_ORIGIN', 'https://fly-with-safety.netlify.app'),

  // Database
  databaseUrl: getEnv('DATABASE_URL', ''),
  directUrl: getEnv('DIRECT_URL', ''),

  // JWT
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret-change-in-production'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '15m'),
  accessTokenCookieMaxAgeMs: getEnvNumber('ACCESS_TOKEN_COOKIE_MAX_AGE_MS', 15 * 60 * 1000),
  refreshTokenExpiresDays: getEnvNumber('REFRESH_TOKEN_EXPIRES_DAYS', 30),

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
  smtpEmailFromName: getEnv('SMTP_EMAIL_FROM_NAME', 'FlyWithsafety'),
  smtpService: getEnv('SMTP_SERVICE', ''),
  emailDeliveryEnabled: getEnvBool('EMAIL_DELIVERY_ENABLED', true),

  // Google OAuth
  googleClientId: getEnv('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
  googleCallbackUrl: getEnv(
    'GOOGLE_CALLBACK_URL',
    // 'http://localhost:5000/api/v1/auth/google/callback',
    'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback',
  ),

  // Stripe
  stripePublishableKey: getEnv('STRIPE_PUBLISHABLE_KEY', ''),
  stripeSecretKey: getEnv('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET', ''),

  // Admin seed
  adminEmail: getEnv('ADMIN_EMAIL', ''),
  adminPassword: getEnv('ADMIN_PASSWORD', ''),

  // Frontend URL
  frontendUrl: getEnv('CORS_ORIGIN', 'https://fly-with-safety.netlify.app'),

  get isGoogleOAuthConfigured(): boolean {
    return Boolean(this.googleClientId && this.googleClientSecret);
  },
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
      problems.push(
        'JWT_SECRET must be set to a random value of at least 32 characters in production',
      );
    }
  }
  if (env.refreshTokenExpiresDays < 1 || env.refreshTokenExpiresDays > 90) {
    problems.push('REFRESH_TOKEN_EXPIRES_DAYS must be between 1 and 90');
  }
  if (env.accessTokenCookieMaxAgeMs < 60_000 || env.accessTokenCookieMaxAgeMs > 60 * 60 * 1000) {
    problems.push('ACCESS_TOKEN_COOKIE_MAX_AGE_MS must be between 60000 and 3600000');
  }

  // Google OAuth validation: if one credential is provided, both must be provided
  const hasClientId = Boolean(env.googleClientId);
  const hasClientSecret = Boolean(env.googleClientSecret);
  if ((hasClientId && !hasClientSecret) || (!hasClientId && hasClientSecret)) {
    problems.push(
      'Partial Google OAuth configuration: both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided',
    );
  }
  if (env.googleCallbackUrl) {
    try {
      new URL(env.googleCallbackUrl);
    } catch {
      problems.push(`Invalid GOOGLE_CALLBACK_URL: ${env.googleCallbackUrl}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Environment validation failed:\n - ${problems.join('\n - ')}`);
  }
}
