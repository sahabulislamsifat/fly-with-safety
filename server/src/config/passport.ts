import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';

interface PassportInternal {
  _strategy(name: string): unknown;
}

export function configureGoogleStrategy(customConfig?: {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}): boolean {
  const clientId = customConfig?.clientId ?? env.googleClientId;
  const clientSecret = customConfig?.clientSecret ?? env.googleClientSecret;
  const callbackUrl = customConfig?.callbackUrl ?? env.googleCallbackUrl;

  if (isGoogleStrategyConfigured()) {
    passport.unuse('google');
  }

  if (!clientId || !clientSecret) {
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL: callbackUrl,
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      },
    ),
  );

  return true;
}

export function isGoogleStrategyConfigured(): boolean {
  return Boolean((passport as unknown as PassportInternal)._strategy('google'));
}

// Automatically configure upon load if credentials are provided in env
configureGoogleStrategy();

export default passport;
