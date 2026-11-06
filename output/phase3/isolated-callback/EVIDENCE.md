# Preparation evidence

- Historical rotated authentication: saved `../ngrok-public-proof-20261104-01/auth-result.json` passed=true, authenticatedSessionStarted=true, ownedProcessStopped=true.
- Historical public outcome: NGROK_UPSTREAM_UNCONFIRMED; 0 pass, 0 fail, 31 unexecuted. Source establishes exact hostname log matched before URL parsing of addr failed. Raw field not retained; format/root cause beyond parser rejection unknown. No native entitlement error recorded.
- Historical restoration: handoff-result.json backendRestored=true, frontendPreserved=true.
- New unit tests: 26 PASS, 0 FAIL, 0 SKIP, exit 0.
- New actual ephemeral loopback integration: 1 PASS covering nine allow/deny requests, four deliveries only, exit 0. Initial sandbox run failed EACCES; outside-sandbox loopback-only run passed. No public network or database was involved.
- New runtime strict TypeScript exit 0. Initial module/type resolution errors corrected before final check.
- Node smoke syntax exit 0. Native Windows PowerShell 5.1 parser PASS, exit 0.
- Current read-only health: frontend3000 HTTP200; backend5000 /api/v1/health HTTP200, database up, development. Connector count 0. No service restart. An initial check used incorrect /health path; corrected to existing documented /api/v1/health, without changing the app.
- New public smoke: NOT EXECUTED. Genuine payment runtime: NOT STARTED. Database/provider calls: NONE.
- Phase 3 remains NOT ACCEPTED. Accepted 64-check PostgreSQL / 79 browser evidence unchanged.

Caller SHA256: 4BA7B09FE7FC8B8FE4ED744E97044CF1A6CEE2E6C0F4713CCDF89A2808F0C3BC
Manifest SHA256: E91B302B6AD659CEAE3EDEF320F5174FDF135026614AA96CB0798E96FE9049F1
