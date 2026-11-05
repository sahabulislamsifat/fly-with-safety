# Entry-point correction, no execution

The previously approved Invoke-Capture.ps1 hashes correctly but invokes absent smoke.cjs with the old smoke flag and omits the cached Playwright path. The preparation replacement failed to match the original source line. Original caller, manifest, eight dependencies and all historical evidence remain unchanged. No capture attempt was created.

Invoke-Capture-v02.ps1 changes only that invocation to capture.cjs --owner-approved-browser-only with the existing cached Playwright module path and an existence check. It performs no install/download. Public scope, private config, ACL/binary/source guards, domain, ephemeral ingress, browser behavior,180s budget and cleanup unchanged. Syntax and exact entry-point delta checked; capture.cjs Node syntax PASS. New approval of the corrected hash is required before execution under the owner's exact-reviewed-caller policy.

Corrected SHA256: 5CF376050228562E39114B1D7573443BFAF0C0134414AA530B4ED84A84198EDF
