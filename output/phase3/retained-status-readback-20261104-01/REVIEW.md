# One retained status-token readback — separate approval required

Actual consumed v02 evidence: HTTP 200, JSON object, APIConnect DONE, one element; transaction/amount/currency match. Only STATUS_ENUM failed. The previous diagnostic mapped an unknown status to OTHER, losing its exact spelling. No raw response was saved, so its precise value cannot be recovered offline. This is a diagnostic gap; no financial SDK defect or provider outcome is inferred.

Only change: bounded cloned-response observer retains the exact safe status token (up to 40 characters, constrained letters/digits/whitespace/underscore/hyphen); known credentials, transaction/validation/bank/card identifiers and identifier-like values are excluded. Types and trim/case-fold comparisons are diagnostic only. No normalization is applied to financial evidence. Original response and strict SDK are unchanged; an unsupported value still fails closed and may produce exit 1 despite usable diagnostics.

Execution: Invoke-RetainedQuery.ps1 -OwnerApprovedRetainedQuery launches server/test/phase3-status-readback/main.ts --owner-approved-status-readback-v01. Private existing restricted-role password is masked; merchant configuration is read privately. Exact local DB flywithsafety_local_integration / restricted role / OID 34701, eight migrations, four actors, two staff recipients and 23 owned retained rows must pass read-only guards. One official verified-HTTPS GET for only the old incomplete intent, two controlled read-only rollbacks and protected preservation comparison. Parent outcome <=110 seconds; no retry.

No SUCCESS provider query, initiation, validation, refund, tunnel/browser, financial write, cloud access, migration, grant, deletion or service change. Previous callers and artifacts remain immutable. This readback does not authorize payment or satisfy genuine FAIL/CANCEL acceptance. Phase 3 NOT ACCEPTED; Phase 4 ON HOLD; budget $0.

Offline checks are recorded in offline-result.json. New one-time approval is required before execution; no attempt has been made.
