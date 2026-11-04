# Rotated private configuration only — owner requested, no network authorization

Policy: direct; dependency context; impact verification; no delegation. Owner confirmed exposed credential revoked and replacement created privately. Do not print or compare it with any previous value.

The previous endpoint-free auth PASS remains historical accepted evidence of the credential path, not proof that this newly rotated token authenticates. This procedure does not rerun any consumed caller, connect ngrok, stop services or touch database/provider state.

## Exact action

One fresh local configuration attempt. Pin installed Store agent3.39.11.0 and executable SHA2566CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16. Read replacement token only through SecureString owner-console prompt. Validate obvious input errors without trimming or silently changing it. Serialize quoted YAML directly with .NET into new LOCALAPPDATA/FlyWithSafe/ngrok-rotated-config-20261104-01/ngrok-auth.yml, outside repo, under owner+SYSTEM-only ACL. File CreateNew prevents overwrite. Never call config add-authtoken; no native/process command argument or environment variable receives the token. Only the private file path reaches native ngrok config check. Suppress native output; no token length/hash/prefix/raw YAML/error retained. Verify exact in-memory serialization round trip, file ACL and private-file syntax directly. A synthetic negative test with repeated --config (invalid first, safety second) returned exit0; therefore this workflow validates the private file ALONE. This does not establish runtime merge behavior or the historical authentication cause. Safety configuration remains separately pinned; combined config-check success is not claimed as private-file validation.

Only config check executes, which validates syntax locally. No start/http/tcp/tls command, no endpoint, no dashboard/API/authentication network session, no SSLCommerz or database operation. Prior private/default configs, successful auth artifacts and consumed public packages are unchanged. Any failure preserves the new attempt/private partial state; no cleanup, overwrite, retry or repair. Existing old credentials are not read.

## Prepared callback continuation after actual local config PASS

Future reviewed public isolation must explicitly use this new private path, never the revoked default/old private configuration. Static origin remains https://russel-semisacred-elise.ngrok-free.dev. Reuse unchanged existing edge policy and four exact callback form POST routes, default deny, no Google OAuth, no TLS bypass, explicit public SNI, no cloud fallback. Require actual account/hostname/policy binding and first correlated callback before remaining30 probes. Current normal frontend3000 stays running; current Main backend5000 is never a tunnel upstream. Any isolated listener5000 handoff requires a newly verified ownership snapshot and separate explicit approval, including safe connector shutdown before normal restore. No consumed public package replay and no endpoint starts from this setup.

Actual Hosted Checkout/IPN/Order Validation and new synthetic writes remain a later separately approved scope against local flywithsafety_local_integration, never Main/Staging cloud. Existing Phase1/2 and PG64/browser79 evidence intact. Phase3 NOT ACCEPTED.
