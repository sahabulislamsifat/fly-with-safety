# Owner-controlled credential actions

The owner reports that real environment credentials were pasted in an earlier conversation. Treat those reported credentials as exposed. This review does not retrieve or reproduce their values, and does not rotate anything automatically.

| Service / secret | Owner action |
|---|---|
| Hosted PostgreSQL / Prisma resources | Rotate the exposed database credential in the correct provider resource; update only its matching pooled DATABASE_URL and direct DIRECT_URL securely. Keep each cloud resource distinct from local Phase2. |
| SMTP | Revoke exposed application password and issue a replacement; update private runtime configuration. No test email is authorized here. |
| Google OAuth | Rotate the exposed client secret in the matching Google project; update private configuration and preserve approved redirect URIs. |
| SSLCommerz sandbox | Rotate/reset exposed sandbox store credential through the provider; retain sandbox-only configuration for Phase3. |
| JWT signing secret | Replace exposed signing secret under an approved session-invalidation plan; existing sessions may need reauthentication. Do not change the application secret automatically. |
| Seed/admin credentials | Change any exposed/reused account password and invalidate affected sessions under a separately approved account operation. |

Do not send replacement values in chat, tracked files or evidence artifacts. Local restricted-role password recovery is a separate operation: first verify the existing password through native psql's private prompt. A password reset is not yet justified by the saved evidence alone. If the current role password is unavailable or direct authentication still fails, request narrow owner-approved role/password investigation; never reset the database or broaden grants.

Actual `.env` files were checked through Git filenames/ignore status only. They are not currently tracked; server/.env, client/.env and client/.env.local are ignored. This is not a claim that every historical source file or external chat is free of exposed secrets. Existing `.env.example` files remain the placeholder configuration boundary; actual local/cloud secrets are not read for this review.
