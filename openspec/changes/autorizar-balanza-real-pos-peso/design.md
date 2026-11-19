## Current Contracts

- `terminal_devices` and `terminal_device_bindings` are represented by canonical V075 in this branch. `installation_id` is globally unique identity, not proof of possession. Existing registration and resolution currently accept the installation identifier under the user-authenticated runtime flow; they are not Agent credential authentication.
- `terminal_device_bindings` binds a cloud installation to a logical `terminals` row. It does not identify a peripheral scale and must not be reused as a scale binding.
- V103 now owns `terminal_device_credentials`, `terminal_scale_bindings` and durable weight-capture persistence in QA. Runtime code uses those canonical repository contracts; no historical V094/V095 replay or history repair is permitted.
- Peripheral Agent local `unitVerification` is display/configuration evidence only. Commercial KG verification is a separate authenticated operator action persisted by the API.
- ROCHI logical `PeripheralDevice.id` is `serial-rochi-a01e-<16 hex>` derived from upper-cased PnP Device Instance ID. COM port is mutable connection metadata. The Agent's existing ID contract is authoritative for this foundation; installationId is not scale identity.
- `sale_creation_idempotency` protects duplicate sale requests. It does not atomically consume a weight capture and cannot provide capture replay protection.

## Pairing and runtime authorization

The API signs short-lived challenge payloads with `AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM`, `AGENT_ENROLLMENT_SIGNING_KEY_ID` and `AGENT_ENROLLMENT_AUDIENCE`. The private key is supplied by protected API runtime secret storage only. Pairing operations use a separate trust configuration containing the fixed API base URL, Ed25519 verification public key, key ID and audience from trusted packaged/installer configuration; browser input cannot change them.

The Agent permits at most 2,000 ms of future skew for the signed challenge's `issuedAt`, addressing the observed 200 ms Windows/issuer clock difference. The allowance is limited to that timestamp: `expiresAt` must still be strictly in the future and the signed challenge lifetime must remain at most 300,000 ms. Signature verification and every key/context binding remain unchanged.

HU-PAIRING-API-SKEW supersedes the earlier statement that API signing behavior was unchanged. The installed Agent qa.16 predates the 2,000 ms Agent allowance and rejects any `issuedAt` later than its own clock, while Build 08 qa.17 cannot reach that host because the Windows A-to-B update is NO-GO. The API signer therefore sets `issuedAt = API now - 2,000 ms` (`AGENT_PAIRING_ISSUED_AT_BACKDATE_MS`) and `expiresAt = issuedAt + lifetime`, where the lifetime is an integer greater than 2,000 ms and at most 300,000 ms (`AGENT_PAIRING_CHALLENGE_MAX_LIFETIME_MS`; default 300,000 ms). The signed window is measured from `issuedAt` and never exceeds 300,000 ms; the remaining validity from issuance is the lifetime minus 2,000 ms (298,000 ms by default). Invalid lifetimes or clocks fail with `AGENT_PAIRING_INPUT_INVALID`.

Security invariants are unchanged: Ed25519 signature over the canonical challenge, key ID, audience, installation ID, terminal device ID, enrollment-key fingerprint, nonce format, pairing code, single-use `jti` (the `terminal_device_credentials_credential_id_unique` index maps a replay to `PAIRING_CHALLENGE_ALREADY_USED`), strict expiry and existing authentication. API-side verification still rejects an `issuedAt` later than the API clock, an expired challenge or a window over 300,000 ms. Compatibility: qa.16 accepts when its clock lags the API by at most 2,000 ms; qa.17 accepts up to 4,000 ms (2,000 ms backdate plus its own 2,000 ms allowance). Both still reject expiry, tampering, wrong key, key ID, audience or installation. No Agent, installer, POS, Electron or Windows configuration changes. The code change has no deployment authority: the QA API must be deployed separately, and task 19 (QA signing key) and task 20 (physical pairing) remain open.

HU-SCALE-BINDING-REVOKE-GUARD corrects operator-flow defects observed during QA pairing on release `a9c91b25`; it does not change any signing, verification or authorization rule. Confirmed by source: `getTerminalState` returns the most recent `terminal_scale_bindings` row with any status, and `saveScale` revoked it whenever its logical scale differed, so a `REVOKED` binding produced `SCALE_BINDING_NOT_ACTIVE` after the terminal settings had already been saved. The same query selected `c.status` and `c.expires_at` but not `c.credential_id`, so the snapshot never exposed the credential ID and "revoke authorization" could not revoke the Agent credential. The UI now revokes a binding only when its status is `PENDING` or `AUTHORIZED`, revokes the credential only while the snapshot reports it authenticated, and reports a scale save outcome as association saved, saved with a failed prior-binding revocation, or saved with a failed refresh, instead of a single false success or failure. The API snapshot now returns `credentialId`; credential revocation still matches `credential_id`, tenant and `ACTIVE` status.

The approval UI also refuses a locally held pairing challenge that expires within 5,000 ms (`PAIRING_APPROVAL_EXPIRY_MARGIN_MS`) and clears it, requiring a new challenge from the Agent. After `PAIRING_CHALLENGE_INVALID` or `PAIRING_CHALLENGE_ALREADY_USED` it likewise drops the challenge. This is a preventive guard: an expired reused challenge is the most likely cause of the observed `PAIRING_CHALLENGE_INVALID`, but that cause was not proven because the API returns one code for every verification failure. API verification, Ed25519, single-use `jti`, multi-tenant scoping and error contracts are unchanged.

HU-SCALE-REVOKED-BINDING-REBIND fixes a QA blocker seen on Terminal 1 after the Agent and scale were replaced: the latest binding was `REVOKED` for the previous logical scale (`serial-rochi-a01e-960a8f6286fa3222`) while the configured scale was the new one (`serial-rochi-a01e-fb2f9ed4566578b4`). `deriveScaleAuthorizationUiState` compared the configured scale with any latest binding, so the revoked one produced `SCALE_MISMATCH` and disabled "Crear asociación comercial". The UI now treats only a `PENDING` or `AUTHORIZED` binding as current. A `REVOKED` binding is history: it does not block a new association and its recorded `KG_VERIFIED` never counts as current confirmation, authorization, REAL readiness or Agent sync, and the unit display shows it as pending. A `PENDING` or `AUTHORIZED` binding for another scale still blocks everything with `SCALE_MISMATCH`. The backend already supports this transition: `createBinding` ignores `REVOKED` rows, revokes only `PENDING`/`AUTHORIZED` ones and still requires tenant scope, an active operational device binding, an active credential and the persisted terminal scale. The API snapshot's own `realAvailabilityReason` still reports `SCALE_MISMATCH` for a revoked binding of another scale; the UI does not display it and it never makes REAL available, so it is left unchanged here.

Runtime requests made with an already-enrolled DPAPI credential use a narrower configuration: the fixed API base URL plus the stored credential. `agent/validate`, readiness observations and capture observations authenticate with the opaque credential ID/secret and the API verifier; they do not verify an enrollment challenge and therefore do not require the pairing public key, key ID or audience. The API base URL remains fixed local/installer configuration and is never renderer input. Missing runtime URL or invalid/expired/revoked credentials fail closed; they never trigger pairing or anonymous requests. `status` may expose a pending challenge only when the complete pairing trust configuration is valid and the challenge can be verified.

### Bounded READY persistence

The authenticated commercial-observation flow keeps its existing transaction around the `PENDING` to `READY` transition. Immediately before `WeightCapturePersistence.markReady`, the API sets PostgreSQL `statement_timeout` with `set_config(..., true)`, making the 1,500 ms limit transaction-local. `markReady` currently issues four sequential SQL statements; each is therefore server-cancelled within the limit, with a maximum six seconds of PostgreSQL statement execution for this segment. The setting is cleared by either COMMIT or ROLLBACK before the client returns to the pool. A PostgreSQL cancellation (SQLSTATE `57014`) follows the existing `READY_UPDATE` failure log and rollback path; it does not change domain validation, SQL update semantics or HTTP mapping. No JavaScript race is used, so PostgreSQL stops the active statement instead of leaving it running after the request fails. If rollback itself fails, the original error remains the request error and the client is destroyed instead of being returned to the pool with an open transaction or local setting.

### Exclusive acquisition observation protocol

QA Terminal 1 rejected a REAL capture with `CAPTURE_NOT_PENDING_OR_EXPIRED`. The capture was `PENDING` and not expired, so the failing condition was `observedAt < created_at`: `created_at` comes from the API clock, while `observedAt` is the Agent's Windows wall clock, measured about 0.72 s behind NTP. A wall-clock tolerance cannot fix this safely, because Agent qa.16 coalesces concurrent ROCHI reads. A capture that arrives while an earlier read is closing its port receives a frame taken before the capture request, and the API cannot tell skew from a borrowed frame.

`EXCLUSIVE_ACQUISITION_V1` replaces wall-clock ordering with causality. The `captureId` is a random UUID created by the API and handed to the Agent through the POS, so the Agent cannot know it before `created_at`. On `/scale/capture` the Agent records acceptance on its monotonic clock, waits until every earlier serial operation on that scale has fully closed, then opens a new serial session. A frame from that session is necessarily later than the capture's creation. A capture never joins a pending read, and no other read joins a capture. A second capture while one is in progress gets `SCALE_CAPTURE_BUSY` (Electron reports it as the existing generic Agent HTTP error).

The authenticated observation carries `requestToFrameMs` (acceptance to frame) and `frameAgeMs` (frame to submission), both on the Agent's monotonic clock. The API bounds both at 15,000 ms and enforces the 60-second TTL and `PENDING` state on its own clock. `observedAt` is persisted unchanged for audit, with only a 300,000 ms sanity bound.

The attestation is trusted exactly as far as `observedAt` already was: only the holder of the terminal device credential can submit it, and only for a capture of its own tenant, device and logical scale. The sale still requires the capture nonce, which only the POS holds, and the existing atomic `READY` to `CONSUMED` transition.

Compatibility follows the deployment order: the API first, then the Agent.
- An API without V1 rejects a V1 Agent's extra fields with `CAPTURE_OBSERVATION_INVALID`, so a new Agent must never be installed against an old API.
- The new API accepts legacy qa.16 observations with the original strict checks while `SCALE_WEIGHT_CAPTURE_LEGACY_OBSERVATION` is unset or `ENABLED`.
- Setting it to `DISABLED` after the fleet upgrade refuses legacy observations with `CAPTURE_PROTOCOL_UNSUPPORTED`.
- Negotiation is per observation: the declared protocol selects the rule, and unknown protocols are invalid.

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

## Windows lifecycle P0: conservation and admission before effects

### Scope and ownership

P0-A/P0-B remain normative lifecycle security contracts in this active change, including the fail-closed evidence classification. File-level implementation ownership of `backend-perifericos/windows-installer/main_windows.go` is transferred to `windows-uninstall-process-lifecycle` for lifecycle admission and update work; the scope matcher does not delegate by function. This transfer does not move Agent authentication, enrollment, pairing, scale authorization or their code from this change. Lifecycle implementation must preserve this P0 contract, including rejection of unknown evidence, and cross-reference `windows-uninstall-process-lifecycle/specs/windows-uninstall-process-lifecycle/spec.md`, especially "Explicit silent-uninstall data policy" and "Ordered payload and registration cleanup". Existing data-retention, explicit authority and verified-completion requirements continue to apply.

### Coordinated Electron close adapter

`desktop/electron/main.ts` keeps its existing SINGLE_MATCH owner, `autorizar-balanza-real-pos-peso`. The lifecycle change defines the close acceptance boundary; this owner implements only the Electron window close adapter and pure close-policy tests. `quit` calls Electron's ordinary `app.quit()` path so `before-quit` authorizes the ensuing window close; `hide` prevents destruction and hides the window. This adapter does not claim process-tree ownership, terminate children, or certify Windows lifecycle cleanup. The helper in `main_windows.go` remains outside this adapter and is blocked until lifecycle identity/handoff and destructive ROOT-05 gates pass.

The lifecycle owner may change `backend-perifericos/windows-installer/main_windows.go` only after its own renewed scope/STRICT/apply-ready checks and all lifecycle gates. `main_windows_test.go` remains owned by `controlar-descubrimiento-perifericos-reales`; lifecycle work must use a separately owned focused test file or resolve that exact test-file ownership before editing it. No change to ROCHI A01E/protocol/weight acquisition, Agent authentication/pairing/enrollment, COM5, XP-80, drawer, service runtime behavior or LocalService storage is granted here. If lifecycle work needs another shared file or significant productive reordering, stop that block and report it; do not treat the ownership transfer as runtime or installation authorization.

### P0-A: conservative registered commands

Normal `UninstallString` and `QuietUninstallString` must target the intended installer executable with the supported uninstall command and preserve configuration, enrollment, device registry and operational data by default. Silent invocation is not data-removal consent. Quote the executable using the existing Windows argument contract; paths with spaces must remain one executable argument. Do not invent a silent flag or change supported arguments beyond removing implicit `--remove-data` from generated quiet metadata.

The same pure metadata policy must apply whenever install, valid repair or supported update generates uninstall registration. Keep explicit data-removal intent separate: it needs verifiable operator approval for the intended operation/managed targets under the lifecycle contract. A legacy registered command containing `--remove-data` is not evidence of fresh consent. This P0 contract neither certifies nor implements destructive removal or helper authorization.

Compatibility tests must cover the prior registered command shapes and preserve supported explicit argument parsing without activating deletion. Old registrations require separate read-only review and a later authorized correction path; changing source or passing pure tests does not update any host registry value. Do not execute a legacy quiet command to test compatibility or silently rewrite the host in this checkpoint.

### P0-B: evidence classification

Use existing read-only validators and a pure decision model. Observe the intended Agent/POS payload and installed metadata/version, the exact existing uninstall-registration contract and the managed-service registration/configuration; distinguish authoritative absence from failed/incomplete queries. Cross-check installed evidence against the applicable installed-version and supported target-version contracts, not merely the incoming manifest. Neither an empty version nor an isolated path/registry value establishes fresh or coherent state.

| Classification | Required evidence and decision |
| --- | --- |
| Proven fresh | Required payload/installation metadata, uninstall registration and managed service are authoritatively absent and no contradictory installation evidence exists; normal absence is admissible, not an error. |
| Valid repair | Explicit repair intent or an existing supported same-version repair contract, coherent installed payload/metadata/version, registration and managed-service configuration; admit only the validated existing repair behavior. |
| Valid update | Coherent installed evidence plus an explicitly supported installed-to-target version transition; admit only that existing update behavior. |
| Partial/inconsistent | Any present installation footprint conflicts with or lacks required companion payload, metadata/version, registry or service evidence; reject with a specific diagnostic. |
| Unknown | Query denied/failed, unsupported version relation, incomplete ownership/evidence or ambiguous observations; reject without interpreting uncertainty as absence. |

Expected retained data after a conservative uninstall is not by itself an active-installation footprint. A proven-fresh reinstall may retain compatible data/configuration without clearing or resetting it; ambiguous data ownership/compatibility remains unknown and cannot authorize repair, replacement or deletion. A stopped but coherently registered service is not alone inconsistent. An incompatible version or discordant service/registry is not an automatic update or recovery plan.

The admission gate must finish before directory/file creation or replacement, persistent preflight/install logs, ACL changes, service stop/start/reconfiguration, registry writes or data changes. Rejected diagnostics may use returned errors, console output or in-memory observations without persistence or secrets. Current source creates a preflight logger and base directories before the version-based fresh/repair decision; a future patch must prove the gate precedes those effects. No automatic cleanup, ACL repair, service fix, fallback fresh install or evidence rewriting is permitted. Recovery requires a separate explicit checkpoint. Classification is an observation, not an atomic namespace or TOCTOU guarantee; observed changes invalidate admission and require a safe stop.

### P0 validation and deferred gates

Pure tests must inject evidence/errors and effect counters: all partial/unknown cases leave every target-effect counter at zero. Cover clean fresh, retained-data reinstall, coherent repair/update, missing version/metadata with footprints, payload mismatch, registry/service discordance, unsupported version, access denied and changed evidence. Metadata tests must exercise normal/quiet commands, quoting, explicit opt-in separation and install/repair/update regeneration. Preserve all existing ROCHI and installer tests.

Documentation and pure tests cannot certify the host registration, qa.13, real install/uninstall or recovery. P1 helper identity/bounded handoff/final result and destructive ROOT-05 remain separate blockers. P2-NATIVE, P3, IPC, durable claims and productive uninstall remain NO-GO.

## QA package profile: no automatic peripheral discovery

The `controlar-descubrimiento-perifericos-reales` change owns the independent `discoverOnStartup` policy. Future QA packages SHALL set `mode=REAL`, `enableRealAdapters=true`, and `discoverOnStartup=false`; production packages SHALL explicitly preserve the current `true/true` profile. Missing or invalid startup-discovery config fails closed. Package health validation SHALL verify health without discovery or hardware calls. The already installed Build 04 and its `enableRealAdapters=false` configuration are not changed by this code work.

The QA profile does not change endpoint/audience selection, provide enrollment trust keys, or make pairing available. Missing QA public key/key ID continues to fail closed for pairing; installation health remains a separate local gate.
