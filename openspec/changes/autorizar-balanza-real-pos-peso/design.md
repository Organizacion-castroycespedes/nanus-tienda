## Current Contracts

- `terminal_devices` and `terminal_device_bindings` are represented by canonical V075 in this branch. `installation_id` is globally unique identity, not proof of possession. Existing registration and resolution currently accept the installation identifier under the user-authenticated runtime flow; they are not Agent credential authentication.
- `terminal_device_bindings` binds a cloud installation to a logical `terminals` row. It does not identify a peripheral scale and must not be reused as a scale binding.
- V103 now owns `terminal_device_credentials`, `terminal_scale_bindings` and durable weight-capture persistence in QA. Runtime code uses those canonical repository contracts; no historical V094/V095 replay or history repair is permitted.
- Peripheral Agent local `unitVerification` is display/configuration evidence only. Commercial KG verification is a separate authenticated operator action persisted by the API.
- ROCHI logical `PeripheralDevice.id` is `serial-rochi-a01e-<16 hex>` derived from upper-cased PnP Device Instance ID. COM port is mutable connection metadata. The Agent's existing ID contract is authoritative for this foundation; installationId is not scale identity.
- `sale_creation_idempotency` protects duplicate sale requests. It does not atomically consume a weight capture and cannot provide capture replay protection.

## Pairing and runtime authorization

The API signs short-lived challenge payloads with `AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM`, `AGENT_ENROLLMENT_SIGNING_KEY_ID` and `AGENT_ENROLLMENT_AUDIENCE`. The private key is supplied by protected API runtime secret storage only. Pairing operations use a separate trust configuration containing the fixed API base URL, Ed25519 verification public key, key ID and audience from trusted packaged/installer configuration; browser input cannot change them.

Runtime requests made with an already-enrolled DPAPI credential use a narrower configuration: the fixed API base URL plus the stored credential. `agent/validate`, readiness observations and capture observations authenticate with the opaque credential ID/secret and the API verifier; they do not verify an enrollment challenge and therefore do not require the pairing public key, key ID or audience. The API base URL remains fixed local/installer configuration and is never renderer input. Missing runtime URL or invalid/expired/revoked credentials fail closed; they never trigger pairing or anonymous requests. `status` may expose a pending challenge only when the complete pairing trust configuration is valid and the challenge can be verified.

### Bounded READY persistence

The authenticated commercial-observation flow keeps its existing transaction around the `PENDING` to `READY` transition. Immediately before `WeightCapturePersistence.markReady`, the API sets PostgreSQL `statement_timeout` with `set_config(..., true)`, making the 1,500 ms limit transaction-local. `markReady` currently issues four sequential SQL statements; each is therefore server-cancelled within the limit, with a maximum six seconds of PostgreSQL statement execution for this segment. The setting is cleared by either COMMIT or ROLLBACK before the client returns to the pool. A PostgreSQL cancellation (SQLSTATE `57014`) follows the existing `READY_UPDATE` failure log and rollback path; it does not change domain validation, SQL update semantics or HTTP mapping. No JavaScript race is used, so PostgreSQL stops the active statement instead of leaving it running after the request fails. If rollback itself fails, the original error remains the request error and the client is destroyed instead of being returned to the pool with an open transaction or local setting.

Pairing start, pending-challenge restoration, challenge verification and envelope acceptance continue to require the full pairing trust configuration. Missing trust fields, an invalid key, or a non-Ed25519 key rejects pairing before network or persistence side effects. Local HTTP remains limited to the existing explicit source-development loopback opt-in; packaged and remote endpoints retain HTTPS requirements.

The Agent generates an RSA-3072 keypair locally and stores its private key plus enrolled credential using CurrentUser DPAPI while running as LocalService. The protected records live under the LocalService state directory and are restricted to LocalService, SYSTEM and Administrators. The public key and signed challenge/pairing code can be relayed to the authenticated operator UI. API approval revalidates the signature, key fingerprint, installation/device/tenant/terminal scope, expiry and code, then stores verifier-only credential state and returns a signed hybrid AES-GCM/RSA-OAEP envelope. The browser relays ciphertext only. Agent verifies, decrypts and stores locally, then confirms possession against the API.

Reading a version 1 DPAPI record is non-mutating: it reads the existing protected record and calls CurrentUser DPAPI without changing its DACL. Restrictive ACLs are applied when the state directory and new protected file are created. A read therefore needs file-read access and the matching DPAPI identity, not `WRITE_DAC`; malformed records and DPAPI failures remain fail-closed.

Remote enrollment endpoints require HTTPS. Local source development may opt in to HTTP only for `localhost`, `127.0.0.1` or `[::1]` by setting `NODE_ENV=development` and `PERIPHERALS_ENROLLMENT_ALLOW_LOOPBACK_HTTP=true`; the Agent additionally requires its `src/main.ts` source entry, so this exception is unavailable to compiled or packaged runtimes and cannot permit remote HTTP hosts.

Agent requests use `Authorization: Agent <credential_id>.<secret>` over the configured HTTPS endpoint. API checks the V103 verifier and active expiry/status/device scope. `REAL_AVAILABLE` is computed per authenticated Agent observation and is never persisted. Physical POS peripheral settings remain configuration; commercial binding is separate. A KG operator action both records `OPERATOR_CONFIRMATION` evidence and performs the domain-approved authorization transition. Binding identity is immutable: changed scale/device requires revoke/rebind, while a COM-only change preserves the Agent logical device ID.

Electron accesses local Agent calls only through narrow typed IPC methods. Browser/Electron memory carries signed challenge/public-key material and ciphertext only; it never receives either private key or the Agent credential.

Windows hardware discovery is asynchronous and bounded: each external
PowerShell inventory command has a seven-second timeout, while the full REAL
scan is bounded to 21 seconds. Printer/PnP and serial stages are independent;
if one source fails, the other source may refresh, the failed source retains
its last known candidates, and the request returns a controlled partial-failure
response rather than clearing device identity or reporting false success.
Discovery itself does not persist the device registry. When an operator
associates a discovered ROCHI, the UI first configures that exact stable PnP-
derived device through `PATCH /devices/:id` (`local-terminal`, `SERIAL`,
`ROCHI_A01E`) and only then persists `pos_terminal_peripheral_settings`. This
configuration does not set unit verification, commercial authorization or
REAL availability; `ScaleService` continues to require a configured device.

## Pure Domain Foundation

Pure policies remain under `api/src/modules/scale-authorization/domain/`; the runtime service/controllers adapt them to V103 persistence without connecting weight-capture consumption to `SaleService`.

1. Credential domain generates a 256-bit opaque secret and SHA-256 verifier, returns clear secret only from the issuance primitive, compares verifiers in constant time, and evaluates expiry/revocation. There is no caller or persistence adapter in this phase; production must not invoke this primitive until a canonical credential table and secure enrollment protocol are approved.
2. Binding domain models `PENDING`, `AUTHORIZED`, `REVOKED`, `DISABLED` and `NOT_VERIFIED`/`KG_VERIFIED`; transition to `AUTHORIZED` requires explicit operator evidence that the displayed unit was `kg`, a coherent tenant/branch/terminal/device/scale context, and preserves the evidence fields. `AUTHORIZED => KG_VERIFIED` is invariant.
3. Stable scale identity policy accepts the canonical Agent peripheral ID plus a present PnP identity/profile and deliberately ignores COM changes. It never derives identity from installationId, COM, display name or VID/PID alone.
4. Readiness is a pure backend policy result, not persisted state. It checks credential state, binding state/context, KG verification, exact expected-vs-observed logical scale ID, and fresh healthy Agent observation; unavailable or stale observations fail closed.
5. Capture domain binds tenant, branch, POS terminal, operational terminal, POS session, product, logical scale and authorized binding. It rejects non-REAL, non-KG or unverified-unit observations. Its state transitions include `PENDING`, `READY`, `CONSUMED`, `EXPIRED`, `REJECTED`; consume compares all context and nonce and returns updated consumed state. Since this state is in-memory data, it is a specification/testing primitive only; durable single-use enforcement requires atomic persistence and is not claimed here.
6. Weighted sale contract accepts a capture reference/nonce only; a client-provided weight/unit/source is rejected. It is not connected to `SaleService`; UNIT flow stays unchanged.

## Persistence and Activation Gate

Canonical persistence is introduced by the single forward-only identity
`V103__scale_authorization_persistence.sql`, selected by a fresh same-operation
DEV_TO_QA evaluation immediately before file creation. Persistent reservations
are unsupported: the created migration file occupies V103 in the repository.
This scope is DEV_TO_QA only, not PRD/global certification or permission to
execute. Re-evaluate collisions before integration and promotion; if another
V103 appears, stop and rerun governed version selection without overwriting or
silently retaining a conflict.

Supported inputs are (A) clean DEV where both credential and binding tables
are absent and (B) the exact known, empty QA-compatible historical tables. The
migration validates the known structure and required constraints before
adoption; it rejects partial/unknown shapes, does not drop/recreate, replay
historical V094/V095, modify migration history or certify historical execution.
Fiscal data remains out of scope.

Credentials persist only public ID, verifier version/hash, lifecycle metadata,
tenant/device ownership and actors. Bindings persist explicit
`OPERATOR_CONFIRMATION`, displayed `kg`, confirmer and timestamp; the database
and domain enforce `AUTHORIZED => KG_VERIFIED`. COM is not identity and
physical identity changes require revoke/rebind.

`terminal_scale_weight_captures` stores a nonce verifier, domain lifecycle,
expiry, exact transaction context and authoritative REAL/kg/unit-verified
measurement. A conditional PostgreSQL update claims only an unexpired READY
capture with an exact context and currently authorized KG binding, records the
sale/consumer, and returns the persisted weight. The future caller must perform
this claim in the same transaction as sale finalization; replay and concurrent
second claims fail. `REAL_AVAILABLE` is derived, never stored; stability is not
inferred.

Credential and binding repositories are wired only to the scoped pairing/admin/Agent runtime endpoints. Durable capture consumption remains disconnected from `SaleService`. QA runtime activation still requires protected Ed25519 key provisioning and physical LocalService/ROCHI validation; PRD promotion remains out of scope.

### Version evaluation scope

Migration version allocation for this HU may be evaluated as `DEV_TO_QA` using
the current repository plus fresh, same-operation, read-only QA
history/schema evidence. Such a result is only a DEV→QA collision-free version
proposal; it does not certify PRD compatibility, global historical
completeness or production promotion. `QA_TO_PRD`/`GLOBAL` evaluation remains
separate and requires fresh PRD evidence in addition to repository/QA evidence
and the existing promotion authorization gates. Evaluation alone does not
reserve a number. Known QA history/schema drift remains visible; history is
never backfilled and historical SQL is never replayed, renamed or recertified.

The persistence implementation starts only after scoped DEV_TO_QA evaluation
is verified. It does not authorize executing the migration in QA or production.

## Threat Boundaries

- Never serialize credential secret to browser, renderer, logs or Agent installation identity.
- Domain code is not a substitute for an authenticated Agent request or server-side trust boundary.
- Tenant/branch/terminal/session/product/scale/binding mismatches fail closed.
- `MOCK`, client-supplied quantity/weight and stale Agent observations cannot satisfy the gate.
- Persistence primitives in this phase are not exposed as production endpoints.
