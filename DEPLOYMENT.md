# Environment configuration

## Local development

Keep real values in ignored files. Do not add secrets to this file or an example file.

`client/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://fly-with-safety-server.vercel.app/api/v1
NEXT_PUBLIC_LOCAL_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Keep the existing `server/.env` database settings. For a local API server, set these values there without changing `DATABASE_URL`:

```dotenv
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
```

Start services in separate terminals:

```powershell
pnpm --dir server dev
pnpm --dir client dev
```

The browser checks `GET /api/v1/health` once per 30 seconds while frontend runs on `localhost` or `127.0.0.1`. A healthy local API is selected. Otherwise it selects deployed API. It resolves before sending each request and never replays a request against another server.

## Netlify frontend

Set at build time:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://fly-with-safety-server.vercel.app/api/v1
NEXT_PUBLIC_SITE_URL=https://fly-with-safety.netlify.app
```

Do not set `NEXT_PUBLIC_LOCAL_API_BASE_URL` for this build. `NEXT_PUBLIC_*` values are baked into browser bundle, so rebuild after changes.

## Vercel backend

Set secrets in Vercel, never repository:

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://fly-with-safety.netlify.app,http://localhost:3000
FRONTEND_URL=https://fly-with-safety.netlify.app
GOOGLE_CALLBACK_URL=https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback
DATABASE_URL=<production database URL>
DIRECT_URL=<production direct database URL>
JWT_SECRET=<at least 32 random characters>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
SMTP_HOST=<SMTP host>
SMTP_USER=<SMTP user>
SMTP_PASSWORD=<SMTP password>
SMTP_EMAIL_FROM=<sender address>
```

Register both Google redirect URIs when local OAuth is needed:

```text
http://localhost:5000/api/v1/auth/google/callback
https://fly-with-safety-server.vercel.app/api/v1/auth/google/callback
```

Production cookies use `Secure; SameSite=None` because Netlify and Vercel are different sites. Browsers that block third-party cookies can prevent login or session restoration when local frontend falls back to Vercel. Local and deployed APIs have separate sessions and databases.
