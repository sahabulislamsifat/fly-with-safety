# One-time transport-only execution

The owner has approved one isolated localhost.run forwarding verification. This is the exact executable complement to the prior draft review. It authorizes no financial work. The previous v01 and v02 attempts and their shutdown results are pinned, and a new one-time marker prevents reuse.

- One strict host-key-pinned SSH child and an ephemeral listener bound only to `127.0.0.1`. The listener has no payment router, DB client or credentials. It answers only an exact correlated empty synthetic POST challenge on the reviewed callback path and inert spoof checks. It returns 404 for unrelated requests. Normal ports 3000 and 5000 are excluded.
- Maximum **41 HTTPS requests**, including at most 40 positive forwarding samples and one HTTPS spoof check. One HTTP spoof check remains in the reviewed scope. Samples are spaced approximately 30 seconds apart, with a final scheduled sample before cleanup. Live SSH child exit, error or a changed allocated hostname stops the run. Failed TLS, missing origin correlation or a failed spoof check ends the attempt without retry.
- Entire runner window is bounded at 20 minutes, including a reserved cleanup interval. A PASS requires both spoof checks, a minimum 19-minute span between the first and final correlated forwarding sample, owned connector shutdown and total elapsed time within 20 minutes. The result records sampled availability and process health. It does not establish forwarding availability between samples.
- No database calls, provider requests, Checkout, payment data, environment-secret forwarding or production exposure. Journal stores sanitized categories and results. On interruption, use the separate `transport-stop.request` signal. The caller waits for its owned runner and does not terminate unrelated processes.

Only transport outcome is eligible to pass. FAILED UAT v03 remains separately reviewable after live proof and evidence sealing. No next execution is dispatched automatically.
