# ONE backend-only DNS-gated transport proof — approval PENDING

Policy: compact planning, dependency context, impact verification, no delegation. Preparation writes only this directory and mutable Phase3 evidence log. No frontend/backend stop, tunnel, credential inspection, database mutation or merchant call executed. Historical v01–v04 and accepted proofs unchanged.

## Recommended approach and maintenance necessity

With fixed application ports3000/5000, an isolated listener cannot bind the same127.0.0.1:5000 endpoint while Main backend owns it. Do not attach cloudflared to the Main process or multiplex its normal routes. Use brief BACKEND-ONLY handoff, then a credential-free probe-only process on5000. No extra application port/proxy/database is needed.

Current exact identities frozen:backend9544/supervisor21076;frontend21588/supervisor7940. BeforeHandoff requires allfour PID/parent/creation/script matches, live3000/5000owner rows, bothHTTPhealthy and no connector. Missing/ambiguous port metadata or ownership mismatch STOP before any action. No raw command lines or secrets output. Frontend is monitored, NEVER stopped,restarted,forked or messaged by this package.

## Stop only the independently owned backend

After fresh explicit approval only, create ONE new `service-recovery-20261103-01/stop-backend.request.json`. That existing controller sends private graceful IPC only to its own backend9544. No paired stopfile orfrontendstopfile is written. Backend/supervisor must both disappear within20secondwait; `backend-exit.json` must acknowledge the frozenbackend PID/code0/no signal. No Taskkill,forcedkill,debugger,console injection or unrelatedprocess action. Failed/partial shutdown does not publish a tunnel. Nonzero completed shutdown skips the public proof and may safely restore backend.

Keep frontend21588 alive. If it unexpectedly changes, do not run public proof; restore the safely stopped backend independently. A frontend failure is NEVER used to suppress safe backend recovery (fixes v04 coupling). No synthetic booking,login orpayment requests are sent to Main. Normal UI API calls may be unavailable during maintenance; avoid normalform submission during the approved short window.

## Pure callback host and unchanged readiness/security policy

Seven proof modules are byte-identical tov04:run,probe,connectorconfig,networkdiagnostics,responseclassification,DNSgate,DNSchild. They run from this fresh evidence directory,never via a consumed caller. Publicchild inherits Windows essentials only; no dotenv,app,Prisma,DATABASE_URL,DIRECT_URL,merchant,proxy environment orprovider imports. No private credentials required.

Exclusive127.0.0.1:5000bind plus actual private callback204+marker+correlatedreceipt mustPASS BEFORE cloudflared canstart. This is a local fixedsyntheticbody request,not a realpayment/IPN. Only four exact formPOST routes exist:
- /api/v1/payments/sslcommerz/success
- /api/v1/payments/sslcommerz/fail
- /api/v1/payments/sslcommerz/cancel
- /api/v1/payments/sslcommerz/ipn

All login/account/bookings/admin/unrelatedpaths,methods,query/trailing/case variants andunknownHost rejected; even normal localhostHost cannot reach anapplication because none isinsideprobe. Arbitrary public payloads,cookies orauthorization are notused/logged/forwarded. No authoritative SSLCommerz validation orfinancialsuccess is simulated by this transport proof.

Same signed cloudflared2026.10.7, SHA2562493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343. Explicit emptyconfig/profile,origin127.0.0.1:5000,forcedHostphase3-callback.invalid,noautoupdate,nomanagementdiagnostics,loopback-onlyephemeralmetrics (notanotherapplicationport). Cloudflare Quick Tunnel creates one temporary publicURL;Cloudflare sees onlysyntheticprobe traffic. No account/domainpurchase ormerchant provisioning.

Require hostname AND connectorregistration within60seconds. OS DNSgate atmost8owned lookupchildren/2seconds each/2secondspacing/30secondphase;two consecutive nonempty successes required. No alternate DNS/cacheflush/hosts/proxy/firewall/TLS change. DNS polling is explicit boundedreadiness observation,notHTTP/suite retry.

First public callback is probe1of31,ONCE. Require204/exactmarker/matchinglocalreceipt,TUNNEL_MARKER,method/path,guardcallback andorigin204 beforeother30. Registeredconnector/DNSsuccess alone are not publicreadiness. Preserve31assertions and failon530;no denial relaxed toforcePASS. Overallpublicprocess180seconds,requestcap5seconds/globalabort;untouchedchecks remainUNEXECUTED. Record sanitizedDNS/nativecodes,CFtype/1xxx/media,originreceipt;atmost8KiB responseprefix in memory,no rawbody/header/Location/cookie/token/nonce persisted. No HTTP retry/newhostname/automaticrerun.

## Backend restoration — independent from frontend

Wait atmost200seconds for owned publicchild toEXIT. Restore Main5000 ONLY after oldbackend/supervisor absent,probeexit confirmed (ifstarted),reportedlistener/tunnelshutdown confirmed (ifresult exists) AND separate CIM snapshot proves no connector. Unknown/residualconnector/liveprobe BLOCKSMainrestoration;report state,notforcekill/repair. Originalfrontend may stayalive throughout and is never required toexit.

When safe, fork ONE normalbackend adapter importing existingserver.ts with ordinary private normalconfiguration and READ ONLY mainidentity check. Same normal.env/Googleconfig,worker/payment/notificationdeliveryoff. No merchantsecret inspection/export;normalapplication loads its own config asusual,separately frompureprobe. No migrations,seeds,cleanup orbusinessmutation. Main/staging/localrecords preserved. Readonlymainidentity/health is explicitly part ofrestoration,notpart ofpublicprobe.

Backendhealthpolling atmost60seconds,no childrestart. Verify newPID/config/readonlyidentity andHTTP200/databaseup. Frontendhealth/liveness monitored independently: unexpectedfrontendfailure cannot prevent safe backendrestore,doesnottriggerfrontendaction,andmakes overallworkflow notfullyPASS. Controller records explicitNOT_STARTED/UNCONFIRMED exits,backendrestore andfrontendpreservation separately;no unconditionalPIDlivenessclaim.

Foreground maintenance outcome budget360seconds;publicphase180. Restoredbackend/controller intentionally remainrunning. Exceptional shutdown/ownership/connector uncertainty can block restoration andneedoperatorattention ratherthanriskexposingMain. Currentservices remainRUNNINGuntilapproval.

## Offline and evidence

New17focusedtestsPASS/0FAIL/0SKIP (8VMflow,9policy/status/diagnostic). Theyprove frontendneverforked/stopped,onebackendstop/oneproof,failedproofsaferecovery,frontendoutageindependence,nonzerostop/unconfirmedprobe/residualconnector guards. Preflightrejectionalso retains allowlistedreason/code andsafehealthbooleans,notrawerrorvalues. No real process ornetwork operation inVMtests. ExistingDNS/routecode andpreviousofflineevidence reusedunchanged,notrepeatedPhase1/2/64PG/79browserproofs.

Prior ACTUAL31-case TCPloopback evidence remains applicable:unchangedguard/handler/responsepolicy sourcehashes andv03result preserved. No newcallbackbind now whileMain5000active; mandatory freshprivatepreflight happensafterapprovedhandoff BEFOREpublication. Currentnormalfrontend/backendbothHTTP200/databaseup,andactualownerrowsCIMmatchesverifiedread-only. FinalnativePS5.1/type/syntax/pins status recordedinverification.json.

No newpublicprooforSSLCommerzsession/validation/IPN/refund occurred. DNSrace remains unproven;this adds no networkfixclaim. Phase3NOTACCEPTED. Approvalmustcover ONE backend-onlymaintenance + boundedpublicproof + safe normalbackend restoration; oldv01–v04authorizations cannot be reused.
