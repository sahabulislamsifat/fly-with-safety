# v02 response530 investigation and bounded response/origin evidence candidate

Policy: compact planning, dependency context, impact verification, no delegation. Writes limited to this new folder and mutable Phase3 evidence log. No original v01/v02 files or accepted application/security evidence modified.

## Actual evidence and uncertainty

v02 journal: listener bound10:49:46.650UTC;origin discovered10:49:53.031;connector registered10:49:53.547;firstPOSTsuccess began10:49:53.548;HTTP530 recorded10:49:54.071;owned connectorSIGTERM10:49:54.081;listener closed10:49:54.082 (Asia/Dhaka16:49:46–16:49:54). Counts1attempted/1HTTPcompleted/0PASS/1FAIL/30untouched. Original result/attempt/checks/journal/caller preserved.

Expected first response:204 AND exact X-FWS-Callback-Probe marker. Observed:530; marker,content-type,headers,body,redirect Location,CF1xxx code and local receipts were not persisted. No redirect-following code exists, but historical response format cannot be reconstructed. Local handler explicitly emits only204/400/404/408/413; it cannot emit530. Official Cloudflare530 documentation identifies an origin-resolution issue with the specific1xxx error in the body. Therefore530 is consistent with an upstream Cloudflare error, not a known handler status. Which CF edge/routing issue, and whether the request reached local origin at all, remain UNDETERMINED. Do not claim1033,propagation delay,Host misrewrite or configuration bug without the missing evidence. Registered connector is not end-to-end HTTP readiness.

The positive callback assertion is correct: a required callback returning530 is unavailable, even if no private route was exposed. Do not accept530 as success or expand the denial-status allowlist. No protected-route exposure was observed: none of the30later probes ran. Public isolation remains UNVERIFIED. v01's earlier network cause is still unknown; do not replace that historical result with v02's530.

Read-only safety inspection: savedPID9808 andmatchingprobe/cloudflared absent;port5000free;v02result tunnelStopped/listenerStoppedtrue. No app,DB,merchant orcredential access. No cloud/service/role/schema change. All16v02pins match. Profile contains no files. No residual public exposure observed.

## Proven local behavior and smallest correction

Unchanged probe.cjs,connector.yml andshared ingress.cjs. Actual loopback-only HTTP test on127.0.0.1:5000:31PASS/0FAIL/0unexecuted,exit0,listener stopped,0public requests/noDB. Six synthetic response-classification/regression cases plus31handler cases:37PASS/0FAIL/0SKIP. Saved530 condition reproduced offline as a positive-callback FAIL; syntheticCF HTML is a diagnostic test fixture, NOT recovered historical response data. Node syntax checks PASS. No accepted Phase1/2/64PG/79browser suite repeated.

Only tooling evidence preservation changed: allowlisted response media/server-is-Cloudflare/CF-header presence/error-type/1xxx-body-code/challenge/redirect flags; at most8KiB response prefix in memory, no raw body/header values orLocation saved. No raw connector stream persisted. Add per-request non-authentication correlation ID, not logged; matching local receipt records only probe index,Host class,method/path-match booleans andstatus. This shows whether the exact probe reached origin and which fixed Host arrived without logging arbitrary public paths,headers,payloads orcredentials. Existingnetworkcode/milestone/shutdown diagnostics retained. First mismatch copied into sanitized result andconsole output.

No guard/config/delay/retry/response-assertion workaround added. Numeric budgets unchanged. Bounded prefix reading has an absolute5second timer and global180second abort so response-body collection cannot extend the original approved budgets. This is NOT a verified fix for Cloudflare530. Normal backend/main cloud must never be attached to this probe.

## Proposed ONE new public execution — fresh approval required

Only after explicit approval: Invoke-CallbackProbe.ps1 -OwnerApprovedOnePublicBoundaryEvidence. Same signed2026.10.7 binary,exactSHA,emptyconfig/profile,origin127.0.0.1:5000,forcedHostphase3-callback.invalid,31same public requests,60second startup/5secondrequest/180secondtotal budget plusowned shutdown. Any existing5000listener,attempt,pin mismatch orfailedcheck:STOP;never terminateexistingservice/retry. A printedURL plusregisteredconnector only permits firstcheck;neither is acceptance. Same four exact formPOST callbacks;alllogin/admin/account/bookings/unrelatedroutesdenied. No app/database/client/.env/merchant/SSLCommerz/supplier/SMTP access orwrites. Body inspection concerns only synthetic transport responses. Owned listener/tunnel closed oncompletion/failure;preserve allnewartifacts. No unapproved private Host bypass orauthentication weakening.

Actual31public PASS required; no skipped orsecure-denial positive callback may be countedPASS. If another530 appears, stop once andretain itsCFerror classification plusmatchedoriginreceipt;then applyonlytheverifiedspecificenvironment/configcorrection. Do not silentlyretry53x,startanotherhostname,tuneprotocols oraddsettlingwaits.

References reviewed2026-11-03:
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-530/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-error-headers/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/ (possible example only; NOT observed)

Phase3 NOT ACCEPTED;genuineSSLCommerz andfinalacceptancepending. Fresh caller hash/pins/PS5.1 status recorded in verification.json;manual foreground command released only after newapproval.
