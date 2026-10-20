import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Candidate .env file locations (current working dir, server dir, monorepo root)
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(currentDir, '../../.env'),
  path.resolve(currentDir, '../../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
}

export function normalizeOrigin(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  return parsed.origin.toLowerCase();
}

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

function resolveFrontendUrl(nodeEnv: string): string {
  const val = process.env.FRONTEND_URL?.trim();
  if (val) {
    return normalizeUrl(val);
  }
  if (nodeEnv === 'production') {
    const corsEnv = process.env.CORS_ORIGINS?.split(',')[0]?.trim() || process.env.CORS_ORIGIN?.trim();
    if (corsEnv) {
      try {
        return normalizeUrl(corsEnv);
      } catch {
        return '';
      }
    }
    return '';
  }
  return 'http://localhost:3000';
}

function resolveApiBaseUrl(nodeEnv: string, port: number): string {
  const val = process.env.API_BASE_URL?.trim();
  if (val) {
    return normalizeUrl(val);
  }
  if (nodeEnv === 'production') {
    const callbackEnv = process.env.GOOGLE_CALLBACK_URL?.trim();
    if (callbackEnv) {
      try {
        const u = new URL(callbackEnv);
        return `${u.protocol}//${u.host}`;
      } catch {
        return '';
      }
    }
    return '';
  }
  return `http://localhost:${port}`;
}

function resolveGoogleCallbackUrl(nodeEnv: string, apiBaseUrl: string): string {
  const val = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (val) {
    return normalizeUrl(val);
  }
  if (apiBaseUrl) {
    return `${normalizeUrl(apiBaseUrl)}/api/v1/auth/google/callback`;
  }
  if (nodeEnv !== 'production') {
    return 'http://localhost:5000/api/v1/auth/google/callback';
  }
  return '';
}

function resolveCorsOrigins(nodeEnv: string, frontendUrl: string): string[] {
  const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  if (raw) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        try {
          return normalizeOrigin(item);
        } catch {
          return item;
        }
      });
  }
  if (frontendUrl) {
    try {
      return [normalizeOrigin(frontendUrl)];
    } catch {
      return [];
    }
  }
  if (nodeEnv !== 'production') {
    return ['http://localhost:3000'];
  }
  return [];
}

class EnvironmentConfig {
  private _nodeEnv?: 'development' | 'production' | 'test';
  private _port?: number;
  private _frontendUrl?: string;
  private _apiBaseUrl?: string;
  private _googleCallbackUrl?: string;
  private _googleClientId?: string;
  private _googleClientSecret?: string;
  private _corsOrigins?: string[];
  private _jwtSecret?: string;

  get nodeEnv(): 'development' | 'production' | 'test' {
    if (this._nodeEnv !== undefined) return this._nodeEnv;
    const val = process.env.NODE_ENV?.toLowerCase().trim();
    if (val === 'production') return 'production';
    if (val === 'test') return 'test';
    return 'development';
  }
  set nodeEnv(val: 'development' | 'production' | 'test') {
    this._nodeEnv = val;
    this._corsOrigins = undefined;
    this._frontendUrl = undefined;
    this._apiBaseUrl = undefined;
    this._googleCallbackUrl = undefined;
  }

  get port(): number {
    return this._port !== undefined ? this._port : getEnvNumber('PORT', 5000);
  }
  set port(val: number) {
    this._port = val;
  }

  get frontendUrl(): string {
    if (this._frontendUrl !== undefined) return this._frontendUrl;
    return resolveFrontendUrl(this.nodeEnv);
  }
  set frontendUrl(val: string) {
    this._frontendUrl = val;
    this._corsOrigins = undefined;
  }

  get apiBaseUrl(): string {
    if (this._apiBaseUrl !== undefined) return this._apiBaseUrl;
    return resolveApiBaseUrl(this.nodeEnv, this.port);
  }
  set apiBaseUrl(val: string) {
    this._apiBaseUrl = val;
  }

  get corsOrigins(): string[] {
    if (this._corsOrigins !== undefined) return this._corsOrigins;
    this._corsOrigins = resolveCorsOrigins(this.nodeEnv, this.frontendUrl);
    return this._corsOrigins;
  }
  set corsOrigins(val: string[]) {
    this._corsOrigins = val;
  }

  get corsOrigin(): string {
    return this.corsOrigins[0] || '';
  }

  get googleClientId(): string {
    return this._googleClientId !== undefined ? this._googleClientId : getEnv('GOOGLE_CLIENT_ID', '');
  }
  set googleClientId(val: string) {
    this._googleClientId = val;
  }

  get googleClientSecret(): string {
    return this._googleClientSecret !== undefined ? this._googleClientSecret : getEnv('GOOGLE_CLIENT_SECRET', '');
  }
  set googleClientSecret(val: string) {
    this._googleClientSecret = val;
  }

  get googleCallbackUrl(): string {
    if (this._googleCallbackUrl !== undefined) return this._googleCallbackUrl;
    return resolveGoogleCallbackUrl(this.nodeEnv, this.apiBaseUrl);
  }
  set googleCallbackUrl(val: string) {
    this._googleCallbackUrl = val;
  }

  get isGoogleOAuthConfigured(): boolean {
    return Boolean(this.googleClientId && this.googleClientSecret);
  }

  // Database
  get databaseUrl(): string { return getEnv('DATABASE_URL', ''); }
  get directUrl(): string { return getEnv('DIRECT_URL', ''); }

  // JWT
  get jwtSecret(): string {
    return this._jwtSecret !== undefined ? this._jwtSecret : getEnv('JWT_SECRET', 'dev-secret-change-in-production');
  }
  set jwtSecret(val: string) {
    this._jwtSecret = val;
  }
  get jwtExpiresIn(): string { return getEnv('JWT_EXPIRES_IN', '15m'); }
  get accessTokenCookieMaxAgeMs(): number { return getEnvNumber('ACCESS_TOKEN_COOKIE_MAX_AGE_MS', 15 * 60 * 1000); }
  get refreshTokenExpiresDays(): number { return getEnvNumber('REFRESH_TOKEN_EXPIRES_DAYS', 30); }

  // Rate limiting
  get rateLimitWindowMs(): number { return getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000); }
  get rateLimitMax(): number { return getEnvNumber('RATE_LIMIT_MAX', 100); }
  get authRateLimitWindowMs(): number { return getEnvNumber('AUTH_RATE_LIMIT_WINDOW_MS', 900000); }
  get authRateLimitMax(): number { return getEnvNumber('AUTH_RATE_LIMIT_MAX', 10); }

  // SMTP
  get smtpHost(): string { return getEnv('SMTP_HOST', ''); }
  get smtpPort(): number { return getEnvNumber('SMTP_PORT', 587); }
  get smtpSecure(): boolean { return getEnvBool('SMTP_SECURE', false); }
  get smtpUser(): string { return getEnv('SMTP_USER', ''); }
  get smtpPassword(): string { return getEnv('SMTP_PASSWORD', ''); }
  get smtpEmailFrom(): string { return getEnv('SMTP_EMAIL_FROM', ''); }
  get smtpEmailFromName(): string { return getEnv('SMTP_EMAIL_FROM_NAME', 'FlyWithsafety'); }
  get smtpService(): string { return getEnv('SMTP_SERVICE', ''); }
  get emailDeliveryEnabled(): boolean { return getEnvBool('EMAIL_DELIVERY_ENABLED', true); }

  // Stripe
  get stripePublishableKey(): string { return getEnv('STRIPE_PUBLISHABLE_KEY', ''); }
  get stripeSecretKey(): string { return getEnv('STRIPE_SECRET_KEY', ''); }
  get stripeWebhookSecret(): string { return getEnv('STRIPE_WEBHOOK_SECRET', ''); }

  // Admin seed
  get adminEmail(): string { return getEnv('ADMIN_EMAIL', ''); }
  get adminPassword(): string { return getEnv('ADMIN_PASSWORD', ''); }
}

export const env = new EnvironmentConfig();
export type Env = typeof env;

export function validateEnv(): void {
  const problems: string[] = [];

  if (!['development', 'production', 'test'].includes(env.nodeEnv)) {
    problems.push(`Invalid NODE_ENV: ${env.nodeEnv}`);
  }
  if (env.port < 1 || env.port > 65535) {
    problems.push(`Invalid PORT: ${env.port}`);
  }

  // Frontend URL validation
  if (!env.frontendUrl) {
    problems.push('FRONTEND_URL is required');
  } else {
    try {
      const u = new URL(env.frontendUrl);
      if (env.nodeEnv === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        problems.push(`FRONTEND_URL cannot be localhost in production: ${env.frontendUrl}`);
      }
    } catch {
      problems.push(`Invalid FRONTEND_URL: ${env.frontendUrl}`);
    }
  }

  // API Base URL validation
  if (!env.apiBaseUrl) {
    problems.push('API_BASE_URL is required');
  } else {
    try {
      const u = new URL(env.apiBaseUrl);
      if (env.nodeEnv === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        problems.push(`API_BASE_URL cannot be localhost in production: ${env.apiBaseUrl}`);
      }
    } catch {
      problems.push(`Invalid API_BASE_URL: ${env.apiBaseUrl}`);
    }
  }

  // CORS Origins validation
  if (env.corsOrigins.length === 0) {
    problems.push('At least one CORS origin is required');
  }
  for (const origin of env.corsOrigins) {
    try {
      const u = new URL(origin);
      if (env.nodeEnv === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        problems.push(`CORS origin cannot be localhost in production: ${origin}`);
      }
    } catch {
      problems.push(`Invalid CORS origin: ${origin}`);
    }
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

  // Validate Google Callback URL if configured
  if (env.googleCallbackUrl) {
    try {
      const u = new URL(env.googleCallbackUrl);
      if (env.nodeEnv === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        problems.push(
          `GOOGLE_CALLBACK_URL cannot be localhost in production: ${env.googleCallbackUrl}`,
        );
      }
    } catch {
      problems.push(`Invalid GOOGLE_CALLBACK_URL: ${env.googleCallbackUrl}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Environment validation failed:\n - ${problems.join('\n - ')}`);
  }
}
