# FlyWithSafe Travel Agency

FlyWithSafe is a full-stack assisted-booking travel agency web platform built with Next.js, Express, TypeScript, and PostgreSQL (Prisma).

## Documentation & Runbooks

- [Production Operations & Deployment Runbook](file:///e:/Programming/Project/fly-with-safety/docs/OPERATIONS.md)

## Architecture

- **Frontend**: Next.js 16 (React 19, Turbopack, App Router) with Vanilla CSS styling.
- **Backend**: Express TypeScript REST API (`/api/v1`), structured JSON logging, Helmet, CORS, and Zod validation.
- **Database**: PostgreSQL with Prisma ORM.
- **Notification Resilience**: Transactional Outbox pattern with background worker, lease concurrency protection, exponential backoff, stuck task recovery, and staff redrive.

## Verification & Commands

```bash
# Server Vitest test suite
cd server && npx vitest run

# Server type check
cd server && npx tsc --noEmit

# Client type check
cd client && npx tsc --noEmit

# Client linter
cd client && npx eslint src app

# Client production build
cd client && npx next build
```