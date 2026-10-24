# FlyWithSafe website audit — resumed verification

Date: 2026-10-22. Branch: `development`, tracking `origin/development`.

This resumes the interrupted Phases 1–7 audit. Existing changes were preserved. The previously declined browser command had not completed; its checks were rerun through approved execution. No database mutation, SMTP test, deployment, push, environment-file change, or edit to `client/app/layout.tsx` was performed.

## Confirmed defects and fixes

| Defect / root cause | Fix and changed files |
| --- | --- |
| Invisible native date inputs received focus without reliably opening the picker. Native click could also close a programmatically opened picker. | New `client/src/components/booking/DateInput.tsx` explicitly opens on click, Enter, and Space; prevents the successful click's second native action. `BookingSearch.tsx` uses the shared control. |
| Departure, return, hotel checkout, and multi-city dates could become inconsistent; UTC date slicing could disagree with the Bangladesh business day. | `client/src/lib/travel-dates.ts`, `BookingSearch.tsx`, flight/hotel results pages enforce date boundaries and adjust dependent dates. |
| Flight API returned `pricing`/`outbound` and an airline string; UI expected `price`/`outboundLeg` and an airline object. | `client/src/lib/api/flights.ts` maps the real API contract into the existing UI model. Nonzero prices, itinerary, baggage, flexibility, and ranking fields now reach consumers. |
| Premium Economy used incompatible request values. | The API adapter translates `premiumEconomy` to `premium_economy` and maps responses back. |
| Multi-city search discarded later itinerary legs. | `BookingSearch.tsx` routes multi-city requests through the existing specialist inquiry with every leg in notes. No live multi-city booking capability is claimed. |
| Route prop synchronization repeatedly overwrote manual route edits; swapping airports distorted the grid. | `BookingSearch.tsx` applies changed route props once and positions the swap control without an extra grid column. |
| Infant count could exceed adult count after adults decreased. | `PassengerClassPopover.tsx` clamps infants and supports Escape even after a counter loses focus. |
| Popovers, footer payment items, and admin loading state overflowed narrow screens. | Width/position/wrapping fixes in `AirportSelectorPopover.tsx`, `PreferredAirlinePopover.tsx`, `PassengerClassPopover.tsx`, `Footer.tsx`, and `AdminPortal.tsx`. |
| Booking modal lacked reliable overlay placement and keyboard lifecycle. | `BookingModal.tsx` renders in a body portal, constrains height, locks/restores scrolling, traps/restores focus, and guards Escape during submission. |
| Closed mobile navigation retained interactive descendants; open navigation could exceed viewport height. | `Navbar.tsx` adds inert/hidden semantics and viewport scrolling. |
| Nested main landmarks and absent home-page H1 weakened document structure. | `privacy/page.tsx`, `terms/page.tsx`, flight/hotel results pages, and `HomePageClient.tsx`. |
| Modify Search dropped passenger/return query fields. | Flight results preserve query parameters and adjust an earlier return after departure changes; hotel results enforce checkout bounds. |
| HTTP failures could be accepted when body claimed success; `Headers` objects lost custom headers. | `client/src/lib/api/client.ts` checks HTTP status and uses `Headers`, preserving idempotency keys. |
| Outbox table checks cached transient failures as permanently missing. | `server/src/services/outbox.service.ts` only treats PostgreSQL `42P01` as missing, expires negative cache after 30 seconds, and propagates transient errors. Regression coverage in `notification-outbox.test.ts`. |
| **Found during resumed verification:** raw ISO flight timestamps expanded mobile results to 477px at a 320px viewport. | `flights.ts` exports a compact UTC formatter; flight results and `FlightCompareDrawer.tsx` use explicitly labeled UTC times. Airport-local time zones are not provided by the API. |
| **Found during resumed verification:** shared controls generated random IDs on server and client, causing hydration mismatch errors. | `client/src/components/ui/Input.tsx` uses React `useId` for Input, Textarea, and Select while preserving explicit IDs. |

`server/test/website-regressions.test.ts` covers all four cabin classes through the actual Express search endpoint and client adapter, HTTP failure handling, header preservation, date boundaries, and UTC time formatting.

## Fresh verification

| Gate | Observed result |
| --- | --- |
| Frontend TypeScript | PASS: installed TypeScript binary, `tsc --noEmit`. |
| Frontend ESLint | PASS: installed ESLint binary, `eslint . --max-warnings 0`. |
| Backend TypeScript | PASS: `tsc --noEmit`. |
| Server suite | **123 passed, 6 skipped**, 7 test files passed, 1 skipped. No skipped integration result is counted as passed. |
| Calendar browser checks | **54/54 passed**. |
| Route browser checks | **17/17 routes; 102/102 viewport checks passed**, no captured page exceptions or hydration errors. |
| Interaction browser checks | **13/13 passed**. |
| Form browser checks | **12/12 passed**. |
| Flight comparison | At 320px, document width remained 320px; mapped fare, baggage, and labeled UTC schedule rendered. |
| Production build | **PASS**: default `next build` with Turbopack; compile, TypeScript, and static generation completed, 23/23 pages generated. No webpack build fallback was needed. |
| Production route smoke | **18/18 routes; 108/108 viewport checks passed**, including `/bookings/lookup`, with no captured page exceptions or hydration errors. |
| Diff validation | `git diff --check` passed; Git emitted only an LF-to-CRLF normalization warning. Protected layout has no diff. |

Commands use the installed binaries backing the actual package scripts. Client scripts are `typecheck`, `lint`, and `build`; server scripts are `typecheck` and `test`. No separate frontend unit-test script exists. Browser regressions are saved audit scripts, not an existing CI suite.

### Calendar and browser coverage

Chrome on Windows, local webpack development server, widths **320, 375, 430, 768, 1024, 1440**. Native picker open state, pointer opening, Enter activation, keyboard date selection, required/min values, round-trip/one-way transitions, multi-city chronology, and hotel checkout constraints were exercised.

Routes: `/`, `/flights`, `/hotels`, `/packages`, `/visa-info`, `/contact`, `/privacy`, `/terms`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/admin`, `/track-booking`, `/flights/results`, `/hotels/results`. The final production smoke also covered `/bookings/lookup`.

Interactions include airport/passenger/airline popovers at 320px, infant clamping, multi-city notes, inquiry viewport/Escape, Premium Economy results and nonzero fares, demo labels, booking modal/Escape, navigation menus, sign-in modal, contact validation/error/retry handling, response references, and search-query preservation.

The browser API proxy points to an isolated local Express server with an unreachable dummy database URL and email disabled. Flight/hotel demo searches exercise the real local API. Contact and inquiry success responses use explicit intercepted fixtures. These prove UI handling, **not durable persistence or email delivery**. Account/admin routes were checked anonymously; authenticated staff/customer workflows remain unverified. Database-backed content cannot be fully verified in this setup.

Harness failures were investigated: a narrow viewport inherited from the previous script hid the desktop Sign In readiness target. Each relevant script now initializes its viewport. This was a test isolation defect, not an application login failure.

### Evidence

- `.gravitas/sessions/website-audit/browser-validation.log`
- `.gravitas/sessions/website-audit/client-validation.log`
- `.gravitas/sessions/website-audit/server-validation.log`
- `.gravitas/sessions/website-audit/client-build.log`
- `.gravitas/sessions/website-audit/production-browser-validation.log`
- `.gravitas/sessions/website-audit/working-tree-manifest.txt` (all tracked modifications and untracked files)
- `output/playwright/production-routes-after.json`
- `output/playwright/routes-after.json`
- `output/playwright/calendars-after.json`
- `output/playwright/interactions-after.json`
- `output/playwright/forms-after.json`
- `output/playwright/calendar-before.png`
- `output/playwright/flight-results-mobile.png`
- Reproducible scripts under `output/playwright/`, including `verify-browser.cjs`.

## Security and release gates

The website is **not certified production-ready** by this audit.

1. Six database integration tests remain skipped. Run them only against an owner-designated non-production database with the existing integration safety gate.
2. Confirm the target environment's NotificationOutbox migration state through an authorized release process. This audit did not apply or verify remote migrations.
3. SMTP delivery, retries against a real mail system, and durable transaction/outbox behavior remain unverified.
4. Authenticated customer/admin roles, OAuth, cross-site cookies, password-reset/email-verification delivery, and production configuration need staging end-to-end checks.
5. Prior handoff flagged exposed credentials. Rotation status remains owner-unconfirmed; no secrets were printed or rotated here.
6. Flight and hotel inventory remains demonstration inventory. Demo results do not prove live provider reservations or ticket issuance.
7. Safari/iOS native date pickers, Firefox, and physical mobile devices were not tested. Current browser evidence is Chrome only.
8. A Next.js development advisory about `data-scroll-behavior="smooth"` remains. It was not changed because the user explicitly protected `client/app/layout.tsx`.
9. This is a scoped functional/stability audit, not a penetration test or a complete dependency-vulnerability assessment.

## Safe deployment recommendation

Review the preserved diff, then validate an approved staging deployment with isolated data. The local production build gate passed. Complete the integration, authenticated-user, outbox, SMTP, credential-rotation, and cross-browser gates before approving production. Keep demo labeling explicit. Push and deployment require the user's approval and were not performed.
