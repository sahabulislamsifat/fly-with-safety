# SSH host trust decision — no network SSH execution

Official HTTPS Security and FAQ pages and targeted official-site searches inspected2026-11-04. No independently verifiable SSH host public key/fingerprint was found in the reviewed material. The guessed .well-known/ssh-known-hosts URL could not be accessed through the web tool and is not treated as a published key. This is a bounded search finding, not proof that no official key exists anywhere. No key is pinned or fabricated.

Proposed owner decision: TOFU only for one synthetic transport-only trial. First observed localhost.run SSH host key would be labeled first-use/unverified, its public fingerprint recorded for owner review and stored in a dedicated known_hosts (not normal ~/.ssh configuration). First-connection identity is not independently authenticated. A keyscan alone would not change that status. No private client key, password, agent, DB or SSLCommerz credentials would be sent. No tunnel or scan is authorized by this document.

After explicit TOFU policy consent, prepare the bounded trust-acquisition/confirmation steps and final smoke launcher contract. A public smoke still needs separate approval after complete syntax/flags/paths/dependency/pins/host-trust checks. Transport SSH uses StrictHostKeyChecking=yes against the dedicated pinned file; changed or absent keys STOP, never delete/relearn/accept changed key automatically. No StrictHostKeyChecking=no or discarded validation. No retry/reconnect or fallback host. TOFU approval is not transferable to financial/provider execution; assess trust again before genuine sandbox credentials or payments.

Existing13 offline PASS and callback restrictions preserved. No SSH process, keyscan, listener, tunnel, DB or provider call executed. Normal3000/5000 untouched. Budget$0; Phase3 NOT ACCEPTED; Phase4 ON HOLD.

Sources: https://localhost.run/docs/security ; https://localhost.run/docs/faq .
