# Same-port caller v02 — guard correction only; NOT EXECUTED

Previous v01 caller and every historical artifact are preserved. Owner supplied v01 failure at line26, WaitOne(2000); READY was NOT displayed. Failure precedes Read-Host, attempt creation, PostgreSQL and Vitest. Missing markers are therefore expected for this stage, not permission to retry.

Reproduction under native Windows PowerShell5.1: localhost completion false after2023ms; numeric127.0.0.1 completion false after2007ms; passive listener count0. Async handle type ManualResetEvent, not Mutex. No mutex or stale-lock acquisition exists in the old guard. IPv6 string against its default IPv4 TcpClient produced address-family error in the diagnostic only. DNS-only, firewall, scheduler or another transport cause is not established. The proven caller defect is requiring unrelated active TCP connect completion to establish listener vacancy.

Only code delta: replace that active-connect block by the new hash-pinned Assert-Phase2BackendPortFree.ps1 helper; update manifest binding. Helper queries OS IPv4/IPv6 TCP listener snapshot, blocks every port5000 listener (loopback/wildcard included), stops on enumeration error/invalid metadata and never kills a process. Snapshot is not a reservation: original actual localhost5000 Express bind remains authoritative and fails on races. No timeout extension, lock removal, DB identity/auth/permission/assertion or allowed fixture change.

Offline:9 PASS/0 FAIL/0 SKIP under nativePS5.1 using in-memory endpoint cases only; no sockets/listeners or database operations. Current passive guard also PASS, no DB. Exact-delta comparison and PS5.1 parsing PASS.163 pins (161 previous unchanged pins plus copied private helper and new port helper); copied private helper byte-identical. No attempt exists. Unchanged TypeScript/application checks are reused rather than rerun.

New caller SHA256:38E69EFC239B0EDE4C8A495D433418CD0A3C47113C6D926830E8B4A058DCB43B
Manifest SHA256:32A4C022F927847AD40DC12D645B8590C9A594148FEC0E139A8F6DB191DA1C40

Fresh owner approval required before ONE replacement execution because v01 was attempted and this reviewed caller changed. Scope remains exactly the previously approved same-port ownership/auth read-only preflight + real browser checks + at most16 synthetic Sessions and one new Booking/Passenger/initial History/IdempotencyRecord/Outbox. Preserve all old commercial records and five unattributed users. No DELETE/GRANT/migration/password reset/cloud/provider operations, automatic retry or cleanup. Use existing local role privately. Explicit stop/snapshot followed by approved safe main-backend restoration; frontend3000 remains. Do not execute v01 again.
