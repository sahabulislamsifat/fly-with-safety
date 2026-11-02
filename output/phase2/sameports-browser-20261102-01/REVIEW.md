# Reviewed same-port local test workflow — NOT executed

Caller: Invoke-BrowserHost.ps1
SHA256: 544FD6C40035768B6E40E33A7C8D48DAD1933CFDAC9A24BA7FCB1F0A5EEBD89E
Manifest: 161 pins; hash 79F6D30CF9C9E8FB5147A1C4BA7C9ED94EC8037F5B84C8DFCBA400C3A2C3D6CD.

Requires explicit approval before interrupting working main development. Only backend5000 is switched; original frontend3000 remains with explicit API5000 selection. The agent must confirm its original backend PID/creation context, stop only that owned process after approval, and leave unrelated processes alone. Caller cannot kill any process and refuses an occupied5000 or any prior attempt/artifact. Do not execute before that approval/release.

The owner enters existing restricted-role DB password privately once in foreground PS5.1. Same private input feeds the existing read-only ownership SQL through native psql, then the real app Prisma client. Native failure stops without host startup. Do not repeat the completed schema inventory. Metadata output includes password-format booleans only, not hashes/email/token values. The host enforces exact local database/role/IP/port, original four ledger actor bindings and aggregate password-format/session permission readiness before listening on localhost5000. It does not prove the owner's actual synthetic sign-in password matches until actual login. No normal .env loaded into this test host; real app authentication remains mandatory. Synthetic Google OAuth, SMTP and outbox worker remain disabled.

Approved execution scope must separately cover the bounded sessions and one new booking creation/retry described in ../PHASE2-EXECUTION-SCOPE.md. No existing commercial mutation/replay. Five unattributed users untouched. No DELETE, role/grant/schema/provider/cloud operation. Explicit stop-request closes host and saves exact owned-record snapshot; readiness alone is never acceptance. No automatic retry. Operator-owned lifetime ends with explicit stop, no arbitrary handoff deadline.

After local host closes and private test environment is cleared, restore original normal backend from server directory using unchanged .env: node node_modules/tsx/dist/cli.mjs src/server.ts --no-outbox-worker. Agent confirms actual running main identity and browser/API health. Preserve original frontend and owner browser throughout. Exact fixture cleanup requires separate approval after actual ledger review.
