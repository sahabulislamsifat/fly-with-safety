# Phase3 retained PostgreSQL payment continuation — separate approval required

Target only127.0.0.1:5432/flywithsafety_local_integration,OID34701,existing restricted role flywithsafe_phase2_booking_test. No normal main-cloud runtime, new application port/server, provider/SMTP or browser sign-in is used.

## Accepted root-cause evidence

The consumed first proof stopped at eight identical contenders before payment intent persistence. Its saved owned snapshot is10 rows:4User,2Booking,2Passenger,2initialHistory. Original caller/result/journal are preserved. Original exception guard/index were not captured, so the exact first failing contender remains unavailable.

The owner-executed follow-up is now independently read and ACCEPTED: read-only exit0/passedTrue/ROLLBACK; Asia/Dhaka; OID34701; actual epoch1793654141.663929 versus discarded-offset epoch1793675741.666038, an observed21600.002109s shift. Both owned quotes had2308s remaining, all12 ownership/eligibility flags true, actual-instant future=true and discarded-offset future=false. Owned financial/event/outbox counts0;6 unlisted users/1Session and8completed migrations observed. `accepted-readonly.json` pins the actual source files and parsed observations. The installed-adapter defect reproduces this signature offline; native evidence now confirms the affected timezone and eligible fixture state. It establishes the false-expiry mechanism, not a recovered historical per-contender exception message.

Production fix remains only the two UTC projections in payment-store, already117PASS per loader in the previous batch. No payment service/domain/assertion changes here. This continuation removes user/booking creation and loads the exact existing fixture IDs. Financial operations/assertions and all64 original checkpoint IDs are byte-for-byte unchanged in the operation body.60s case timeout/45s admission cancellation,8contenders/pool/lock order/security assertions remain unchanged. New14 deterministic retained-guard tests PASS per bundled/native loader; strict TypeScript, scoped lint, PostgreSQL18 parsing and nativePS5.1 parsing PASS. No live continuation attempt exists.

## Exact proposed writes

- **Zero new User, Account, Session, Booking or Passenger.** No password/hash changes. Existing four synthetic actors and two owned bookings are reused; their password is not requested by this DB proof.
- At most2 retained GatewayPayment,1GatewayRefund,16 normal-path payment events,5 additional owned BookingStatusHistory and105 new owned queued NotificationOutbox rows. Current2initial history rows stay intact. New booking gateway summaries are restricted to the same two owned JSON records. Existing quote/payment/manual commercial data is not rewritten.
- Same-key8contender initiation/replay, distinct-key8contender admission, duplicate notices/validation, authoritative-provider-double amount/currency/transaction/risk/replay denial, stale lease ownership, capture/history/outbox atomic rollback, refund reservations/reference constraints and preserved-record checks continue exactly as reviewed originally. Rollback-only negative statements use only owned payment/refund/event IDs and intentionally roll back even an unexpected acceptance. The sole committed direct test update expires one owned payment lease for fencing proof.
- Source and native read-only preflight check the exact4actors/2bookings/2passengers/2initialHistory, synthetic tag, quote/amount/currency/state/linkage,6unlisted users/1Session, empty financial ledgers/outbox,8migration checksums/schema/permissions and OID. Quotes must retain **more than90seconds**. Expired/mismatched/short-window state STOPS before business writes; **no quote renewal/expiry extension or automatic retry** is authorized. The90s requirement is stricter fixture admission, not an enlarged case timeout.
- Final owned-ID snapshot, unlisted user/booking/session/outbox metadata and migration comparisons, drain/cancellation/disconnect and all64 checkpoints must pass. Unexpected failure may retain additional owned diagnostic events; the actual ledger always determines later cleanup scope. Nothing is deleted or automatically repaired. Any privileged cleanup needs separately reviewed exact IDs and owner approval.

## Owner execution after approval only

ONE new foreground invocation of `Invoke-RetainedProof.ps1 -OwnerApprovedRetainedPaymentProof`. CallerSHA256:

`DBA2493CBD8580D4D98E02B5343283AEE6519341A1222534E41C3D8691147711`

203dependency pins, fresh exclusive attempt, original accepted schema and read-only results. One private prompt for the EXISTING restricted-role DB password, NOT postgres. Same proven private helper for native psql and Prisma; no password in argv/files/chat/logs. There is no synthetic-account password prompt and no account modification. Process-local credentials/mode flags are cleared finally. Failure consumes this attempt and stops: no old-caller rerun, retry, fixture recreation, cleanup, grant, schema replay, cloud write or provider request.

This is real PostgreSQL application proof using injected provider doubles. It is not genuine merchant session, Order Validation/IPN HTTPS, channel/refund-provider, browser, physical process restart/COMMIT-wire loss or SMTP delivery proof. Bookings remainPENDING; no supplier fulfillment or real payment is fabricated. Phase1 G7/Phase2 14/14 remain accepted; Phase3 remains NOT ACCEPTED until required genuine evidence passes.
