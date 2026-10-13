import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { env, validateEnv } from '../src/config/env.js';
import { configureGoogleStrategy, isGoogleStrategyConfigured } from '../src/config/passport.js';

describe('Google OAuth Route and Strategy Tests', () => {
  const originalClientId = env.googleClientId;
  const originalClientSecret = env.googleClientSecret;
  const originalCallbackUrl = env.googleCallbackUrl;

  afterEach(() => {
    // Restore original configuration
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
        // callbackUrl: 'http://localhost:5000/api/v1/auth/google/callback',
        callbackUrl: 'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback',
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
        // 'http://localhost:5000/api/v1/auth/google/callback',
        'https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback',
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

  describe('Environment configuration and validation', () => {
    it('detects partial OAuth credentials in validateEnv', () => {
      const originalId = env.googleClientId;
      const originalSecret = env.googleClientSecret;

      // Only client ID
      (env as any).googleClientId = 'some-client-id';
      (env as any).googleClientSecret = '';
      expect(() => validateEnv()).toThrow('Partial Google OAuth configuration');

      // Only client secret
      (env as any).googleClientId = '';
      (env as any).googleClientSecret = 'some-secret';
      expect(() => validateEnv()).toThrow('Partial Google OAuth configuration');

      // Restore
      (env as any).googleClientId = originalId;
      (env as any).googleClientSecret = originalSecret;
    });

    it('detects invalid GOOGLE_CALLBACK_URL in validateEnv', () => {
      const originalUrl = env.googleCallbackUrl;
      (env as any).googleCallbackUrl = 'not-a-valid-url';
      expect(() => validateEnv()).toThrow('Invalid GOOGLE_CALLBACK_URL');
      (env as any).googleCallbackUrl = originalUrl;
    });
  });
});
