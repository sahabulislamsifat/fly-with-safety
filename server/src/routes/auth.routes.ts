import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { emailSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from '../validators/auth.schemas.js';
import { env } from '../config/env.js';

const router = Router();

// Configure Google OAuth strategy only if credentials exist
if (env.googleClientId && env.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      }
    )
  );
}

const authRateLimiter = rateLimiter({
  windowMs: env.authRateLimitWindowMs,
  maxRequests: env.authRateLimitMax,
  message: 'Too many authentication attempts. Please try again later.',
});

// Standard auth
router.post('/auth/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/auth/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/auth/logout', authController.logout);
router.post('/auth/refresh', authRateLimiter, authController.refresh);
router.get('/auth/me', requireAuth, authController.getMe);
router.post('/auth/verify-email', authRateLimiter, validate(tokenSchema), authController.verifyEmail);
router.post('/auth/resend-verification', authRateLimiter, validate(emailSchema), authController.resendVerification);
router.post('/auth/forgot-password', authRateLimiter, validate(emailSchema), authController.forgotPassword);
router.post('/auth/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Google OAuth (only mount if configured)
if (env.googleClientId && env.googleClientSecret) {
  router.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  router.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${env.frontendUrl}?auth=failed`, session: false }),
    authController.googleCallback
  );
}

export default router;
