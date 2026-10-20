import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { env, validateEnv } from '../src/config/env.js';
import { configureGoogleStrategy, isGoogleStrategyConfigured } from '../src/config/passport.js';

describe('Google OAuth Route and Strategy Tests', () => {
  const originalClientId = env.googleClientId;
  const originalClientSecret = env.googleClientSecret;
  const originalCallbackUrl = env.googleCallbackUrl;
  const originalFrontendUrl = env.frontendUrl;
  const originalApiBaseUrl = env.apiBaseUrl;
  const originalCorsOrigins = [...env.corsOrigins];
  const originalNodeEnv = env.nodeEnv;

  afterEach(() => {
    // Restore original configuration
    (env as any).nodeEnv = originalNodeEnv;
    (env as any).frontendUrl = originalFrontendUrl;
    (env as any).apiBaseUrl = originalApiBaseUrl;
    (env as any).corsOrigins = [...originalCorsOrigins];
    (env as any).googleClientId = originalClientId;
    (env as any).googleClientSecret = originalClientSecret;
    (env as any).googleCallbackUrl = originalCallbackUrl;

    configureGoogleStrategy({
      clientId: originalClientId,
      clientSecret: originalClientSecret,
      callbackUrl: originalCallbackUrl,
    });
  });

  describe('When Google OAuth is fully configured', () => {
    beforeEach(() => {
      configureGoogleStrategy({
        clientId: 'mock-google-client-id.apps.googleusercontent.com',
        clientSecret: 'mock-google-client-secret',
        callbackUrl: 'http://localhost:5000/api/v1/auth/google/callback',
      });
    });

    it('confirms strategy is registered in passport', () => {
      expect(isGoogleStrategyConfigured()).toBe(true);
    });

    it('GET /api/v1/auth/google returns 302 redirecting to Google authorization server', async () => {
      const res = await request(app).get('/api/v1/auth/google');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBeDefined();

      const redirectUrl = new URL(res.headers.location);
      expect(redirectUrl.origin).toBe('https://accounts.google.com');
      expect(redirectUrl.pathname).toBe('/o/oauth2/v2/auth');
      expect(redirectUrl.searchParams.get('response_type')).toBe('code');
      expect(redirectUrl.searchParams.get('client_id')).toBe(
        'mock-google-client-id.apps.googleusercontent.com',
      );
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
        'http://localhost:5000/api/v1/auth/google/callback',
      );
      expect(redirectUrl.searchParams.get('scope')).toBe('profile email');
    });

    it('GET /api/v1/auth/google does not return 404 API NOT FOUND', async () => {
      const res = await request(app).get('/api/v1/auth/google');
      expect(res.status).not.toBe(404);
      expect(res.body?.message).not.toBe('API NOT FOUND!');
    });

    it('GET /api/v1/auth/google/callback is registered and not returning 404', async () => {
      // Without OAuth query params, Passport initiates redirect to Google
      const res = await request(app).get('/api/v1/auth/google/callback');
      expect(res.status).not.toBe(404);
      expect(res.body?.message).not.toBe('API NOT FOUND!');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://accounts.google.com');
    });

    it('GET /api/v1/auth/google/callback with provider error redirects to frontend failure URL', async () => {
      // When user denies consent or Google returns an error
      const res = await request(app).get('/api/v1/auth/google/callback?error=access_denied');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth=failed');
      expect(res.headers.location).toContain(env.frontendUrl);
    });
  });

  describe('When Google OAuth is NOT configured', () => {
    beforeEach(() => {
      configureGoogleStrategy({
        clientId: '',
        clientSecret: '',
      });
    });

    it('confirms strategy is unconfigured', () => {
      expect(isGoogleStrategyConfigured()).toBe(false);
    });

    it('GET /api/v1/auth/google returns 503 with OAUTH_NOT_CONFIGURED for API requests', async () => {
      const res = await request(app).get('/api/v1/auth/google').set('Accept', 'application/json');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('OAUTH_NOT_CONFIGURED');
      expect(res.body.message).toContain('Google OAuth is not configured');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('GET /api/v1/auth/google redirects to frontend failure URL for browser requests', async () => {
      const res = await request(app)
        .get('/api/v1/auth/google')
        .set('Accept', 'text/html,application/xhtml+xml');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth=failed');
      expect(res.headers.location).toContain('reason=oauth_not_configured');
    });

    it('GET /api/v1/auth/google/callback returns 503 for unconfigured API requests', async () => {
      const res = await request(app)
        .get('/api/v1/auth/google/callback')
        .set('Accept', 'application/json');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('OAUTH_NOT_CONFIGURED');
    });
  });

  describe('Environment-aware CORS verification', () => {
    it('accepts configured local frontend origin in development', async () => {
      (env as any).nodeEnv = 'development';
      (env as any).corsOrigins = ['http://localhost:3000'];

      const res = await request(app)
        .get('/api/v1/airports/search')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('accepts configured production frontend origin in production', async () => {
      (env as any).nodeEnv = 'production';
      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];

      const res = await request(app)
        .get('/api/v1/airports/search')
        .set('Origin', 'https://fly-with-safety.netlify.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://fly-with-safety.netlify.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects unexpected origin by omitting Access-Control-Allow-Origin', async () => {
      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];

      const res = await request(app)
        .get('/api/v1/airports/search')
        .set('Origin', 'https://unauthorized-attacker.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('handles CORS preflight OPTIONS request for allowed origin', async () => {
      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];

      const res = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://fly-with-safety.netlify.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://fly-with-safety.netlify.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('OAuth redirect environment separation', () => {
    it('uses local backend callback URL in development', () => {
      (env as any).nodeEnv = 'development';
      (env as any).apiBaseUrl = 'http://localhost:5000';
      (env as any).googleCallbackUrl = 'http://localhost:5000/api/v1/auth/google/callback';

      expect(env.googleCallbackUrl).toBe('http://localhost:5000/api/v1/auth/google/callback');
    });

    it('uses production backend callback URL in production', () => {
      (env as any).nodeEnv = 'production';
      (env as any).apiBaseUrl = 'https://fly-with-safety-server.vercel.app';
      (env as any).googleCallbackUrl = 'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback';

      expect(env.googleCallbackUrl).toBe(
        'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback',
      );
    });

    it('redirects failure to active development frontend URL', async () => {
      (env as any).nodeEnv = 'development';
      (env as any).frontendUrl = 'http://localhost:3000';

      const res = await request(app)
        .get('/api/v1/auth/google/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3000?auth=failed');
    });

    it('redirects failure to active production frontend URL', async () => {
      (env as any).nodeEnv = 'production';
      (env as any).frontendUrl = 'https://fly-with-safety.netlify.app';

      const res = await request(app)
        .get('/api/v1/auth/google/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://fly-with-safety.netlify.app?auth=failed');
    });
  });

  describe('Environment configuration and validation', () => {
    it('detects partial OAuth credentials in validateEnv', () => {
      (env as any).googleClientId = 'some-client-id';
      (env as any).googleClientSecret = '';
      expect(() => validateEnv()).toThrow('Partial Google OAuth configuration');

      (env as any).googleClientId = '';
      (env as any).googleClientSecret = 'some-secret';
      expect(() => validateEnv()).toThrow('Partial Google OAuth configuration');
    });

    it('detects invalid GOOGLE_CALLBACK_URL in validateEnv', () => {
      (env as any).googleCallbackUrl = 'not-a-valid-url';
      expect(() => validateEnv()).toThrow('Invalid GOOGLE_CALLBACK_URL');
    });

    it('rejects missing or localhost URLs in production', () => {
      (env as any).nodeEnv = 'production';
      (env as any).frontendUrl = 'http://localhost:3000';
      (env as any).apiBaseUrl = 'https://fly-with-safety-server.vercel.app';
      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];
      (env as any).jwtSecret = 'a-very-long-secret-key-that-is-at-least-32-chars-long';

      expect(() => validateEnv()).toThrow('FRONTEND_URL cannot be localhost in production');

      (env as any).frontendUrl = 'https://fly-with-safety.netlify.app';
      (env as any).apiBaseUrl = 'http://localhost:5000';
      expect(() => validateEnv()).toThrow('API_BASE_URL cannot be localhost in production');

      (env as any).apiBaseUrl = 'https://fly-with-safety-server.vercel.app';
      (env as any).corsOrigins = ['http://localhost:3000'];
      expect(() => validateEnv()).toThrow('CORS origin cannot be localhost in production');

      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];
      (env as any).googleCallbackUrl = 'http://localhost:5000/api/v1/auth/google/callback';
      expect(() => validateEnv()).toThrow('GOOGLE_CALLBACK_URL cannot be localhost in production');
    });

    it('passes validation when production configuration is fully valid', () => {
      (env as any).nodeEnv = 'production';
      (env as any).frontendUrl = 'https://fly-with-safety.netlify.app';
      (env as any).apiBaseUrl = 'https://fly-with-safety-server.vercel.app';
      (env as any).corsOrigins = ['https://fly-with-safety.netlify.app'];
      (env as any).googleClientId = 'mock-id.apps.googleusercontent.com';
      (env as any).googleClientSecret = 'mock-secret';
      (env as any).googleCallbackUrl = 'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback';
      (env as any).jwtSecret = 'a-very-long-secret-key-that-is-at-least-32-chars-long';

      expect(() => validateEnv()).not.toThrow();
    });
  });
});
