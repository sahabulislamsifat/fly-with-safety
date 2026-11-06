# DNS-gated callback proof with explicitly approved paired maintenance

Status: OFFLINE PREPARATION ONLY. No service stop, tunnel, merchant request or database mutation executed. New package; v01/v02/v03 remain consumed and unchanged.

Policy: compact planning, dependency context, impact verification, no delegation. Scope: this directory and mutable Phase3 evidence documentation; preserve existing normal development source/environment and historical artifacts. Same callback guard/handler/config/response assertions; no new database, application port, provider, paid infrastructure or payment feature.

## Exact isolation and occupied-port decision

Main development is healthy: backend5000PID17348,frontend3000PID4440,owned supervisor21136. Parent/name/creation-UTC/script metadata frozen in expected-ownership.json. BeforeHandoff read-only check matched allthree; bothHTTP200,backenddatabaseup. DO NOT publish this backend. No service is stopped by preparation or offline tests.

The existing graceful controller has a PAIRED stop action. It cannot safely stop only backend via its current interface. Therefore requested approval must explicitly include a brief frontend3000 AND backend5000 maintenance window; do not describe this as backend-only. If this pause is not approved, STOP and leave both services running. No Taskkill,PIDkill,console injection,debugger or unrelated process termination.

After explicit approval only, Invoke-DnsGatedProof.ps1 checks caller/manifest/pins, signed binary, no attempts or partial files, exact three live owned processes and no connector. handoff.cjs creates ONE new stop-owned-servers.request.json in the existing controller's directory; this sends private IPC to ONLY its owned children. Source/markers are not overwritten. Their append-only lifecycle log must confirm both exit0/no signal and allthree originalPIDs absent within20secondwait; otherwise no public proof. Non-graceful complete stop may safely restore normal development without public execution. Partial/uncertain stop is reported; no forced termination/repair.

## Proof host and readiness

Pure probe is launched in a separate Node process with Windows essentials only. No inherited DATABASE_URL,DIRECT_URL,PG,merchant,proxy variables; no dotenv/app/Prisma/provider imports. Exclusive127.0.0.1:5000bind must succeed. Before cloudflared exists, require one private fixed-body callback POST204+marker+correlated actual origin receipt; failure stops without publishing anything. Normal login/account/admin/bookings routes do not exist in this process. Unknown/localHost requests are rejected by the unchanged probe; four exact formPOST callback paths only.

ONE signed cloudflared2026.10.7,reviewedSHA2562493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343. Same emptyconfig/profile,forcedHostphase3-callback.invalid,target127.0.0.1:5000,updatesoff,diagnosticsoff,loopbackmetrics only. No merchant endpoint/SSLCommerz call. Random public URL is not authentication.

1. Require generated valid HTTPS-root trycloudflare hostname AND connector registration within60seconds. Neither alone means readiness.
2. Bounded OS resolver gate: at most8 read-only observations, each at most2seconds,2secondspacing,30secondDNSphase; require two consecutive nonempty successes. Each lookup runs in a short-lived owned child with explicit timeout/abort, so a stalled native getaddrinfo cannot outlive the probe budget. No alternate resolver,DNSsetting/hosts/cache/proxy/firewall change,IPpinning orTLSbypass. Only sanitized codes/counts/families/timing persisted. Unknown child/protocol failures STOP; known transient DNS results may be observed again only within this approved readiness budget. This is NOT HTTP/suite retry.
3. Original first public POSTsuccess is attempted ONCE and counted as probe1of31. Require204+exactmarker+matching local receipt,TUNNEL_MARKER,method,path,guardcallback andorigin204. It mustPASS before remaining30start. A forgedmarker/530/securedenial is NOT readiness. First-correlated/readiness errors STOP; no public retry/newhostname/relaunch.
4. Keep31unchanged allow/deny cases. Preserve CF530/1xxx/media/challenge/redirect flags,networkerrorcodes andlocaloriginreceipt. At most8KiB responseprefix is read in memory; no rawbody/header,arbitrarypublicURL,correlationnonce,cookie,credential orconnectionstring saved.
5. Same overall180secondpublic-process budget includes localpreflight,DNS andHTTPchecks;60secondstartup,2secondDNSchild,5secondpublicrequest caps; globalabort applies. Time exhausted means remaining checks UNEXECUTED,neverPASS. Owned tunnel/listener close afterPASS/FAIL; no automatic test retry/repair.

## Restoration is part of the proposed approved lifecycle

handoff waits at most200seconds for the owned probe to EXIT. Main5000 may be restored ONLY if old processes stopped,probe exit confirmed,reported connector/listener shutdown confirmed (if result exists),and independent CIM check finds NO connector process. Never restore main behind a residual tunnel. Missing/unconfirmed shutdown or partialhandoff blocks restoration and reports the owned state for owner attention.

When safe, start normal development ONCE using the existing server.ts andNextsource via two narrow restoration adapters. They load their ordinary configuration privately,not into the probe/controller. No merchantsecret inspection/export; normal server loads its own existing config as usual. Main remote Prisma identity is checked in READ ONLY mode,not localintegration;worker,SMTPdelivery andpayments remain disabled. Frontend3000retainslocal5000pin. Existing.envfiles,Googleconfig,databases,schemas,roles,data andlocalfixtures unchanged. No SQLmutation orproviderrequest. Read-only main identity/HTTPhealth are included explicitly in this restoration scope.

At most60seconds normalreadiness polling; do not restart failedchildren. Handoff controller records proof exit and restoration separately, then remains running only to own the restored development children. Private PowerShell prints completion without waiting for normal development toexit. Foreground maintenance outcome deadline360seconds; unconfirmed outcome STOP,no automatic termination. Publicphase still180seconds. Bothservices briefly unavailable during approvedmaintenance; avoid submitting normal forms during this window. In exceptional blocked-restoration cases operator attention is required rather than risking publicmain exposure.

## Offline verification and actual-loopback distinction

Final focused suite69PASS/0FAIL/0SKIP,exit0:23DNS/readiness,31unchanged allow/deny,9restorationpolicy,6VMprocess-order/failure cases. Initial two VMfixtures lacked AbortSignal; supplying the real runtime global fixed only emulation,not assertions/securityrules. No realchildren/OSstop/network/tunnel in VMtests. HelperTStranspile0errors,JSsyntaxPASS. NativePS5.1 parsing,integrity and no-attempt checks recorded in verification.json.

Existing ACTUAL127.0.0.1:5000HTTP31PASS/0FAIL evidence fromv03 remains applicable:probe/guard/config hashes unchanged,loopback-result.json preserved and pinned. Fresh port5000callbacktest is NOT run now because normalbackend owns it. The new private actual-loopback preflight is mandatory AFTERapprovedhandoff and BEFOREtunnelpublication. Offline matrixPASS is not mislabeled as freshTCP orpublicPASS. No Phase1/2/64PG/79browser suite rerun.

DNSpropagationrace remains suspected,NOTproven. This implements observed-readiness gating,not a claim that Cloudflare always becomesready or that530isfixed. If DNS/firstHTTP fails withinbudget,retaindiagnostics,stoponce,andrestoremainONLYwhenconnectorgone. Phase3NOTACCEPTED;genuineSSLCommerz remains separately gated.
