# FlyWithSafe — Operations & Production Runbook

This operational guide provides deployment, maintenance, and administrative instructions for the **FlyWithSafe Travel Agency** application.

---

## 1. System Architecture & Services

The system is built as a decoupled, full-stack travel agency portal:

- **Frontend**: Next.js 16 (React 19, Turbopack, App Router) with responsive, vanilla CSS design system and client-side API layer.
- **Backend**: Node.js / Express TypeScript API (`/api/v1`) with Helmet, CORS, centralized structured JSON logging, strict Zod validation, and rate limiting.
- **Persistence**: PostgreSQL via Prisma ORM.
- **Background Worker**: Transactional Notification Outbox daemon running inside the server process with optimistic leasing, bounded exponential retry backoff, and stuck record recovery.
- **Email Transport**: Nodemailer SMTP with safe development/test mocking when `EMAIL_DELIVERY_ENABLED=false`.

### Product & Domain Truthfulness

- **Inquiries**: Handled for Flights, Hotels, Tour Packages, and Visas. Protected by idempotency keys to eliminate accidental duplicate submissions.
- **Bookings**: Converted only from eligible, non-cancelled Flight, Hotel, or Package inquiries by authorized staff (`STAFF` or `ADMIN` roles). Visa inquiries cannot be converted to bookings.
- **Inventory & Pricing**: The agency operates an assisted-desk model. Quotes and itineraries are managed by travel desk staff. There are **no direct live airline/hotel GDS inventory pipes** and **no simulated inventory**.
- **Payments**: The platform currently provides payment-readiness disclosures. Bookings remain in verified agency offline fulfillment. There is **no live payment gateway integrated**, and the system never fakes payment success.

---

## 2. Environment Variables Dictionary

All sensitive values must be provided securely via environment variables or secret managers (e.g., AWS Secrets Manager, Doppler, Vault). **Never commit real credentials to source control.**

### Backend (`server/.env`)

| Variable Name                |     Required     |          Default          | Purpose                                                                                    |
| :--------------------------- | :--------------: | :-----------------------: | :----------------------------------------------------------------------------------------- |
| `NODE_ENV`                   |       Yes        |       `development`       | Runtime environment (`development`, `production`, `test`).                                 |
| `PORT`                       |        No        |          `5000`           | Port on which the Express server listens.                                                  |
| `DATABASE_URL`               |       Yes        |             —             | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`).                      |
| `JWT_SECRET`                 |       Yes        |             —             | Strong cryptographic secret for signing session access tokens.                             |
| `JWT_EXPIRES_IN`             |        No        |           `15m`           | Lifetime of user access tokens.                                                            |
| `REFRESH_TOKEN_EXPIRES_DAYS` |        No        |            `7`            | Refresh token session expiration in days.                                                  |
| `FRONTEND_URL`               |       Yes        |  `http://localhost:3000`  | URL of the frontend application for CORS, redirect links, and verification URLs.           |
| `CORS_ORIGIN`                |        No        |      Match frontend       | Allowed CORS origin header.                                                                |
| `EMAIL_DELIVERY_ENABLED`     |        No        |          `true`           | When `false`, outbound email delivery is mocked/suppressed (mandatory in automated tests). |
| `SMTP_HOST`                  | If email enabled |             —             | Outbound SMTP host.                                                                        |
| `SMTP_PORT`                  |        No        |           `587`           | SMTP port (e.g., 587 or 465).                                                              |
| `SMTP_USER`                  | If email enabled |             —             | SMTP authentication username.                                                              |
| `SMTP_PASSWORD`              | If email enabled |             —             | SMTP authentication password.                                                              |
| `EMAIL_FROM`                 |        No        | `noreply@flywithsafe.com` | Verified sender address in outbound email headers.                                         |
| `RATE_LIMIT_WINDOW_MS`       |        No        |      `900000` (15m)       | Rate limiting observation window.                                                          |
| `RATE_LIMIT_MAX`             |        No        |           `100`           | General rate limit per IP per window.                                                      |
| `AUTH_RATE_LIMIT_MAX`        |        No        |           `10`            | Strict rate limit for auth and credential-sensitive endpoints.                             |

### Integration Testing Gating

| Variable Name                   | Purpose                                                                                                   |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| `RUN_IDEMPOTENCY_INTEGRATION`   | Must be `true` to run live database-backed idempotency integration tests.                                 |
| `INTEGRATION_TEST_DATABASE_URL` | Must end in `_integration` to prevent running destructive integration scripts against non-test databases. |

### Frontend (`client/.env.local`)

| Variable Name         |       Required        |                      Default                       | Purpose                                            |
| :-------------------- | :-------------------: | :------------------------------------------------: | :------------------------------------------------- | -------------------------------------- | -------------------------------------- | --- | --- |
| <!--                  |                       |               `NEXT_PUBLIC_API_URL`                | Yes                                                | `http://localhost:5000/api/v1`         | Public API endpoint for browser calls. |     | --> |
|                       | `NEXT_PUBLIC_API_URL` |                        Yes                         | `https://fly-with-safety-server.vercel.app/api/v1` | Public API endpoint for browser calls. |                                        |
| `NEXT_PUBLIC_API_URL` |          Yes          | `https://fly-with-safety-server.vercel.app/api/v1` | Public API endpoint for browser calls.             |

---

## 3. Database Migration & Environment Safeguards

1. **Additive Schema Migrations**:
   - The notification resilience outbox is provisioned via migration `20261011120000_notification_outbox`.
   - All migrations must be additive and non-destructive.
   - Do **NOT** run `prisma db push --force-reset` or `prisma migrate reset` against production or staging databases.
2. **Applying Migrations in Production**:
   ```bash
   cd server
   npx prisma migrate deploy
   ```
3. **Database Client Generation**:
   ```bash
   cd server
   npx prisma generate
   ```
4. **Environment Separation**:
   - Production, staging, and development must use completely isolated database instances.
   - Integration tests strictly require a database with name ending in `_integration`.

---

## 4. Local Development Setup & Build Commands

### Initial Setup

```bash
# Install dependencies across monorepo / workspace
pnpm install

# Generate Prisma Client
cd server
npx prisma generate
cd ..
```

### Running Locally

```bash
# Start backend server (port 5000)
cd server
npm run dev

# Start frontend application (port 3000)
cd client
npm run dev
```

### Quality Verification Commands

```bash
# 1. Run server test suite
cd server
npx vitest run

# 2. Server TypeScript check
cd server
npx tsc --noEmit

# 3. Client TypeScript check
cd client
npx tsc --noEmit

# 4. Client lint
cd client
npx eslint src app

# 5. Client production build
cd client
npx next build
```

---

## 5. Health Checks & Diagnostics

The API provides a sanitized diagnostic health endpoint:

```http
GET /api/v1/health
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "FlyWithsafety API is running",
    "environment": "production",
    "database": "up",
    "timestamp": "2026-10-11T12:00:00.000Z",
    "uptime": 86400
  }
}
```

_Note: This endpoint never exposes database connection strings, credentials, or internal error traces._

---

## 6. Transactional Notification Outbox & Worker Operations

### Outbox Mechanics

1. **Atomic Enqueueing**:
   - Customer inquiries and booking lifecycle transitions persist notification records atomically in the same database transaction using `enqueueNotification(tx, input)`.
   - Business data commit and notification scheduling succeed or fail together.
2. **Worker Discovery**:
   - The worker periodically polls eligible `PENDING` records where `nextAttemptAt <= NOW()`.
   - Uses an optimistic lease update (`UPDATE ... SET status = 'PROCESSING' WHERE id = ... AND status = 'PENDING'`) to safely prevent duplicate worker races.
3. **Bounded Retries**:
   - On transport or provider errors, attempts are incremented with exponential backoff ($1\text{m}, 2\text{m}, 4\text{m}, 8\text{m}, \dots \max 30\text{m}$).
   - Once `maxAttempts` (default 5) is reached, the record is marked `FAILED` with sanitized error telemetry for inspection.
4. **Stuck Record Recovery**:
   - If a worker crashes while processing a batch, records left in `PROCESSING` for $> 5\text{ minutes}$ are automatically reset to `PENDING` on the next worker cycle.
5. **Worker Daemon Lifecycle**:
   - The worker starts on server boot via `startOutboxWorker()`.
   - It performs graceful termination on `SIGTERM` / `SIGINT` via `stopOutboxWorker()`.

### Inspecting Outbox Telemetry (Staff / Admin)

Authorized staff can query outbox statistics:

```http
GET /api/v1/admin/outbox
Authorization: Bearer <STAFF_OR_ADMIN_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "outbox": {
      "pending": 0,
      "processing": 0,
      "delivered": 142,
      "failed": 2,
      "total": 144
    }
  }
}
```

### Performing Safe Operator Redrive

To retry a permanently `FAILED` notification:

```http
POST /api/v1/admin/outbox/:id/redrive
Authorization: Bearer <STAFF_OR_ADMIN_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "outbox_id_here",
    "status": "PENDING"
  },
  "message": "Notification queued for redrive"
}
```

---

## 7. Security & Privacy Hardening Precautions

1. **HTML Escaping**: All dynamic inputs in email templates are passed through `escapeHtml()` to eliminate HTML injection and cross-site scripting risks.
2. **Booking Privacy**: Lookup endpoints (`POST /api/v1/bookings/lookup`) require both `referenceNumber` and the exact matching `email`. Non-matching lookups return generic `404 Not Found` to prevent reference enumeration.
3. **Session Revocation**: Logout revokes sessions in PostgreSQL by recording `revokedAt`. Password changes automatically revoke all active user sessions.
4. **Role Enforcement**: `/api/v1/admin/*` routes strictly require `STAFF` or `ADMIN` roles. Attempts by `CUSTOMER` accounts are rejected with `HTTP 403 Forbidden`.
5. **No Secrets in Logs**: Structured loggers filter out authorization tokens, database connection strings, and credential payloads.

---

## 8. Deployment, Backup & Rollback Considerations

### Deployment Checklist

1. Deploy database migrations using `npx prisma migrate deploy`.
2. Deploy backend service and verify `/api/v1/health` reports `"status": "ok"` and `"database": "up"`.
3. Deploy frontend Next.js application.
4. Verify admin portal accessibility at `/admin`.

### Rollback Procedure

- **Preferred Strategy (Application-Code Rollback)**:
  - The notification outbox migration `20261011120000_notification_outbox` is purely additive (creates `NotificationStatus` enum and `NotificationOutbox` table).
  - Reverting application code to an earlier revision preserves the additive schema without breaking existing inquiries or bookings.
  - Previously enqueued outbox entries remain durable in PostgreSQL and can be drained once the service is restored.
- **Destructive Rollback Warning**:
  - Dropping `NotificationOutbox` table or `NotificationStatus` enum (`DROP TABLE "NotificationOutbox"; DROP TYPE "NotificationStatus";`) is **destructive**: it permanently destroys notification audit history, delivery receipts, and all queued/failed records awaiting redrive.
  - **Never execute destructive table/type drop SQL** during routine rollbacks. Schema teardown is reserved strictly for catastrophic, separately approved recovery procedures.

### Backup Assumptions

- Daily automated PostgreSQL backups with Point-In-Time-Recovery (PITR) enabled.
- Ensure database write permissions are limited to the designated application database user.
