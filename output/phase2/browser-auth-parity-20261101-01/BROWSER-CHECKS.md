# Pending browser execution — existing acceptance requirements only

Prerequisite: owner-approved auth-parity host reaches READY; host readiness is not acceptance. Frontend must use `NEXT_PUBLIC_LOCAL_API_BASE_URL=http://phase2.localhost:5002/api/v1` on `http://phase2.localhost:3002`. Do not use the ambient localhost:3000 tab as evidence of isolated database wiring.

Existing routes verified in source: `/account`, `/admin`, `/track-booking`, `/bookings/lookup`. Use fresh browser snapshots for actual controls; no invented selectors or mocked responses. Owner enters existing synthetic account password privately in the page. Do not capture password fields, cookies, authorization headers or network response secrets.

1. Owner customer `/account`: existing FWS-2026-53YFS3 booking; Synthetic Traveller passenger; COMPLETED; BDT12000; three quotations/one accepted; one unverified payment; public history. Refresh and navigate away/back; compare actual API response and displayed state.
2. STAFF and ADMIN `/admin`: same booking, quotations, payment and history; correct staff attribution and authorized controls. Do not reissue, accept, pay or change status merely to repeat accepted commercial tests.
3. Foreign customer and unauthenticated contexts: deny access to the owner's booking/admin operations; inspect actual UI and API status. Keep contexts isolated.
4. Record required loading/error/empty states only where applicable, without claiming mocked responses as database proof.
5. Creation/retry remains a separate bounded mutation gate: the accepted existing-request replay is not initial-create race proof. Prepare exact synthetic scope and seek approval before any new booking fixture is created, as required by the latest master directive.
6. After all dependent checks, stop only this owned API host, preserve its exact-ID ledger, reconcile current rows, then request exact cleanup approval. Historical23 rows are not a substitute for the post-browser inventory.

Current canonical matrix: items1–2 PASS; items3–14 BLOCKED by their remaining evidence, not unimplemented by implication. Accepted39 commercial invariants and prior API/concurrency proofs must be reused. No browser check has executed for this package.
