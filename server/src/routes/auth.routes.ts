import { Router as createRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import passport, { isGoogleStrategyConfigured } from '../config/passport.js';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { error as errorResponse } from '../utils/response.js';
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from '../validators/auth.schemas.js';
import { env } from '../config/env.js';
import { beginGoogleState, verifyGoogleState } from '../middleware/oauth-state.js';

const router: Router = createRouter();

function requireGoogleOAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isGoogleStrategyConfigured()) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      res.redirect(`${env.frontendUrl}?auth=failed&reason=oauth_not_configured`);
      return;
    }
    res.status(503).json(
      errorResponse(
        'OAUTH_NOT_CONFIGURED',
        'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
      ),
    );
    return;
  }
  next();
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
router.post(
  '/auth/verify-email',
  authRateLimiter,
  validate(tokenSchema),
  authController.verifyEmail,
);
router.post(
  '/auth/resend-verification',
  authRateLimiter,
  validate(emailSchema),
  authController.resendVerification,
);
router.post(
  '/auth/forgot-password',
  authRateLimiter,
  validate(emailSchema),
  authController.forgotPassword,
);
router.post(
  '/auth/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// Google OAuth
router.get(
  '/auth/google',
  requireGoogleOAuth,
  beginGoogleState,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      scope: ['profile', 'email'], session: false, state: res.locals.googleOAuthState,
    })(req, res, next);
  },
);

router.get(
  '/auth/google/callback',
  requireGoogleOAuth,
  verifyGoogleState,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      failureRedirect: `${env.frontendUrl}?auth=failed`,
      session: false,
    })(req, res, next);
  },
  authController.googleCallback,
);

export default router;
