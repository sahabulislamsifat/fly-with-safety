# FlyWithSafe customer dashboard implementation

Date: 2026-10-22  
Branch: `development`

## Summary

Reworked `/account` from a basic four-tab account view into a responsive customer portal. It retains FlyWithSafe branding and the existing global navbar, and uses authenticated account data for identity, request/bookings totals, recent activity, and account age. The desktop view has a customer sidebar; the mobile view uses a compact wrapping section menu.

The overview links to existing travel routes. Request and booking lists show server records, details, actual status labels, empty/error/loading states, filters, and pagination. Profile editing remains limited to the existing supported name field; email and role stay protected.

## Before and after

Before, the account page presented an overview, request list, booking list, and a basic profile form in a compact shell. After, it has a branded profile header, account summary, real activity counts, recent requests and bookings, quick links, responsive navigation, paginated lists, and detail views. The global navigation changes to its compact menu at tablet widths so signed-in controls do not overflow.

## Components and API

The work reuses `AccountDashboard` and the existing account API client. It uses:

- `GET /api/v1/account/dashboard` for counts, recent inquiries, and account creation date.
- `GET /api/v1/account/inquiries` and `GET /api/v1/account/inquiries/:type/:reference` for owned requests.
- `GET /api/v1/account/bookings` and `GET /api/v1/account/bookings/:reference` for owned bookings and status history.
- `PATCH /api/v1/account/profile` for the existing name update.
- Existing auth/session endpoints for customer identity and sign-out.

Booking list status filters are validated against the existing `PENDING`, `CONFIRMED`, `COMPLETED`, and `CANCELLED` statuses. Pagination remains server-backed. The account service scopes all these records by the authenticated user ID.

## Unsupported features

The current backend has no customer-owned traveller or loyalty profile API, no protected passport storage, no account payment-history endpoint, no customer change-request workflow, no account-scoped support-ticket system, and no authenticated change-password endpoint. The dashboard labels travel details as unavailable and links password recovery to the existing reset flow. It does not collect passport data, fabricate payments, or present unsupported actions as working.

Requests can still use the existing contact/support route. This does not create an account-tracked support ticket. Password recovery is not represented as an authenticated password change.

## Files changed

- `client/src/components/account/AccountDashboard.tsx` — dashboard shell, summaries, overview, lists, profile, details, navigation, and empty states.
- `client/src/components/navbar/Navbar.tsx` — responsive breakpoint for the existing global navigation.
- `client/src/lib/api/account.ts` — member-date and booking-filter response types.
- `server/src/routes/account.routes.ts` — validated booking-list query.
- `server/src/validators/account.schemas.ts` — allowed booking statuses.
- `server/src/services/account.service.ts` — owner-scoped booking status filtering and authenticated account creation date.
- `server/test/api.test.ts` — booking-filter validation cases.

The existing uncommitted `client/src/components/booking/BookingSearch.tsx` swap-button edit was present before this dashboard work and was preserved without modification.

## Database and security

No Prisma models, schema, migration, database records, credentials, or environment files changed. The account summary reads the existing user `createdAt` field. Profile writes still accept only the validated name field. Account routes continue to require authentication; service queries scope by the authenticated user ID and do not accept a user ID from the browser.

Passport and other sensitive travel documents remain uncollected because there is no approved encrypted storage design. No payment, confirmation, or ticket issuance is simulated.

## Verification

- Client ESLint: passed with `--max-warnings 0`.
- Client TypeScript: passed with `tsc --noEmit`.
- Client production build: passed with Next.js 16.3.6/Turbopack; 23/23 static pages generated.
- Server TypeScript: passed with `tsc --noEmit`.
- Server tests: **125 passed, 6 skipped**; 7 files passed and 1 integration file skipped.
- Browser fixture checks: **7/7 passed** for authenticated identity, account date, booking list/filter, profile save feedback, request navigation, and page overflow.
- Responsive browser widths: **320, 375, 430, 768, 1024, 1440px**; no document horizontal overflow at any width; no browser page errors.
- Browser account API calls were intercepted and answered with explicit test fixtures. This validates rendering and interaction; it does not verify a live authenticated customer account or durable updates.
- `git diff --check`: passed. Git reports only line-ending normalization warnings for two edited files.

Evidence files are under `output/playwright/`: `customer-dashboard-browser.log`, `customer-dashboard-final-validation.log`, `customer-dashboard-build.log`, `account-dashboard-check.js`, and `customer-dashboard-mobile.png`.

The six skipped database integration tests remain unverified. The prior Phase 7 release gates for outbox migration state, SMTP, authenticated staging behavior, and credential-rotation confirmation also remain open. No deployment or push was performed. The dashboard is ready for code review; production approval should wait for those staging/release gates and real account verification.
