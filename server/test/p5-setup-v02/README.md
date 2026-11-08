# P5 setup v02 — maintenance input ordering recovery

Recovery preparation only. New live execution requires owner approval of this version. Never rerun v01, regardless of its missing filesystem marker.

The previous owner-reported `before-network / MAINTENANCE_IDENTITY_REQUIRED` is consistent with v01 Node validation before `work`, `connect` or its attempt marker. The inspected v01 output folder contains only `offline.json`; no saved live result, journal or attempt file was found. This is a persistence gap, not permission to reuse v01, and not an independent catalog proof that proposed resources are absent. No terminal transcript or rejected role value was collected because it could contain a misplaced password. Existing credentials were not read or changed.

v02 changes only the prompt/validation and failure receipt path:

- The ROLE NAME prompt is masked to prevent accidental credential echo. **Press Enter to select `postgres`**. It is not the password prompt.
- The same restricted-role-name format and technical-role exclusions are checked in PowerShell before the deferred password callback. Format validation cannot establish that a role actually exists; the existing authenticated maintenance identity and superuser guards still apply afterward.
- Invalid role format causes a fixed label without echoing the submitted value. Password prompts and the child process are not reached.
- A separate atomic `caller-attempt.json` records consumption before input. Sanitized early failure is saved to `caller-result.json` and `result.json`; network/DDL counts are zero only when the child was not started or its pinned result explicitly says `before-network`. Unknown post-start outcomes remain unknown.
- The new output folder is `output/phase5/p5-approved-setup-20261107-02/`. Existing attempt/outcome evidence blocks reuse. No marker from v01 is deleted, reset or fabricated.
- Windows owned-job type is versioned to avoid a collision with the already loaded v01 type. Containment implementation is otherwise unchanged.

Node provisioning code differs only by the v02 output folder. Database/role constants, role/password validation in Node, STOP-on-conflict policy, private stdin, SCRAM, pinned nine migrations, actual-OID checks, least-privilege grants and deadlines are unchanged. No schema, provider, fixture, normal service or credential mutation occurs during offline preparation. Browser and production rollout remain excluded.

Approve the new hash-pinned caller before running it in a private Windows PowerShell 5.1 console. Three passwords are then requested privately: existing local maintenance password and two new, distinct technical-role passwords (with confirmation). No passwords in chat, script arguments or shell history. Failure means preserve and STOP; no automatic retry or cleanup.
