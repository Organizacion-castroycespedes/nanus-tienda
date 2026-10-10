## ADDED Requirements

### Requirement: Distinguish Agent identity from authentication
The system SHALL NOT treat `installationId`, cloud device ID, terminal ID or peripheral ID as an Agent credential. Credential cleartext SHALL be returned at most once by a future trusted enrollment flow; only a verifier may be persisted server-side.

#### Scenario: Installation identity alone is presented
- **WHEN** an Agent request supplies only `installationId`
- **THEN** the request SHALL NOT satisfy proof-of-possession authentication.

### Requirement: Authorize scale binding only after KG verification
A scale binding SHALL be tenant-, branch-, logical-terminal-, operational-terminal-, cloud-device- and logical-scale-scoped. `AUTHORIZED` SHALL imply `KG_VERIFIED`; renderer input SHALL NOT perform this transition.

#### Scenario: Pending binding without KG confirmation
- **WHEN** a binding is `PENDING` or its unit state is not `KG_VERIFIED`
- **THEN** it SHALL not become commercially ready.

### Requirement: Use stable physical scale identity
The logical scale identity SHALL use the canonical Agent peripheral ID derived from PnP identity. COM port, installationId and display name SHALL NOT be identity keys.

#### Scenario: COM port changes for the same PnP device
- **WHEN** the PnP device remains the same but its COM port changes
- **THEN** its logical scale identity remains the same and the port is treated only as connection metadata.

### Requirement: Derive REAL readiness on the backend
The backend policy SHALL derive readiness from a valid unrevoked/unexpired Agent credential, authorized coherent binding, KG verification, matching scale identity and fresh healthy Agent observation. It SHALL return a reason code and SHALL NOT persist `REAL_AVAILABLE`.

#### Scenario: Any readiness prerequisite is absent
- **WHEN** the credential, binding, unit, scale identity or Agent observation is missing, revoked, mismatched, unverified or stale
- **THEN** readiness is false with a specific fail-closed reason.

### Requirement: Consume a REAL KG capture once
A future weighted sale SHALL reference a server-issued capture bound to tenant, branch, POS terminal, operational terminal, POS session, product, logical scale and binding. The capture SHALL require a REAL, KG-verified observation and durable atomic single-use consumption; client-supplied weight SHALL NOT be authoritative.

#### Scenario: Mock, wrong context or replayed capture
- **WHEN** a capture is MOCK, not KG-verified, expired, context-mismatched or already consumed
- **THEN** the weighted sale is rejected without accepting client weight.

### Requirement: Keep weighted sale integration deferred
This runtime authorization phase SHALL NOT connect capture consumption to `SaleService`, cart, payment or ticket flows. UNIT sales SHALL remain unchanged and weighted sales remain disabled until a separate sale lifecycle change consumes the server capture atomically.

#### Scenario: Authorization is ready but sale integration is deferred
- **WHEN** Agent authentication and scale authorization are ready
- **THEN** no weighted sale is accepted until the separate `SaleService` capture-consumption phase is complete.

### Requirement: Scope migration version evaluation separately from promotion
A DEV_TO_QA migration-version evaluation SHALL use fresh same-operation repository evidence and read-only QA history/schema evidence, and MAY expose only DEV_QA_SAFE_VERSION. It SHALL NOT imply PRD compatibility, migration execution, version reservation or production promotion. QA_TO_PRD/GLOBAL evaluation still requires fresh PRD evidence and separate promotion authorization. Historical replay, artificial backfill, renumbering and retroactive certification remain prohibited.

#### Scenario: Development version is evaluated without PRD access
- **WHEN** repository and QA evidence are verified and fresh for a DEV_TO_QA evaluation
- **THEN** the result may identify a DEV_QA_SAFE_VERSION while GLOBAL_SAFE_VERSION remains UNVERIFIED and PRD_PROMOTION_STATUS remains NOT_EVALUATED.

#### Scenario: Version evaluation is mistaken for production authorization
- **WHEN** a DEV_TO_QA version proposal is verified
- **THEN** it is not reserved and cannot authorize QA-to-PRD promotion or migration execution.

### Requirement: Persist scale authorization without historical replay
The persistence foundation SHALL use one forward-only DEV_TO_QA migration selected from fresh repository and read-only QA evidence. It SHALL support clean DEV and only the known empty QA-compatible legacy shapes, reject unknown or incompatible shapes, and SHALL NOT replay V094/V095 or alter migration history. The migration file occupies its repository version identity; any collision SHALL be re-evaluated before integration or promotion.

#### Scenario: Existing known QA tables are adopted
- **WHEN** both credential and scale-binding tables match their validated known QA shapes and contain no rows
- **THEN** the migration adds only canonical fields/constraints and creates durable capture persistence without dropping or recreating either table.

### Requirement: Persist credential verifiers and explicit KG evidence
Credential persistence SHALL contain a public identifier, verifier version/hash and lifecycle metadata, never the clear secret. A scale binding SHALL persist explicit `OPERATOR_CONFIRMATION`, displayed `kg`, confirmer and verification timestamp; `AUTHORIZED` SHALL require `KG_VERIFIED` with valid evidence. Installation ID is identity only and COM port is not logical scale identity.

#### Scenario: Credential and binding persistence is created
- **WHEN** the authorized persistence layer stores a credential or transitions a pending binding after operator confirmation
- **THEN** only the verifier is stored and KG evidence is explicit and tenant/context scoped.

### Requirement: Durable capture consumption is atomic and sale-disconnected
Capture persistence SHALL store the nonce verifier, exact operational context, expiry and authoritative REAL/kg/unit-verified measurement. Consumption SHALL use one transaction-safe conditional claim that records the canonical sale and consumer and returns persisted weight; replay or a second claimant SHALL fail. The persistence MAY support Agent/readiness endpoints but SHALL remain disconnected from productive SaleService and weighted-sale UI until an approved sale phase.

#### Scenario: Two transactions attempt the same capture
- **WHEN** concurrent callers claim the same valid READY capture
- **THEN** at most one conditional update returns the authoritative persisted weight, and the other caller receives no claim.

### Requirement: Pair Agent using a pinned Ed25519 trust anchor
The Peripheral Agent SHALL enroll against its fixed HTTPS API using a locally generated RSA enrollment keypair protected with Windows DPAPI. The API SHALL sign the enrollment challenge with the environment Ed25519 key, binding the required identity, fingerprint, nonce, pairing code, expiry and credential ID. The Agent SHALL verify a pinned installer-provided public key; the browser SHALL NOT replace the API trust key, API endpoint or signed Agent key.

#### Scenario: Browser substitutes an enrollment key
- **WHEN** browser approval supplies a public key whose fingerprint differs from the signed Agent challenge
- **THEN** approval fails closed and no credential is issued.

### Requirement: Keep credential secret outside the renderer
The API SHALL persist only credential verifier/hash and lifecycle metadata, and SHALL encrypt the one-time credential envelope to the Agent key bound by the signed challenge. The renderer MAY relay only the signed challenge and opaque ciphertext; only the Agent decrypts and persists the secret with DPAPI. Neither private key nor plaintext Agent credential may enter renderer state, localStorage, logs, URLs or installer command lines.

#### Scenario: Agent accepts the encrypted credential
- **WHEN** the Agent receives a valid, unexpired envelope for its pending challenge
- **THEN** it stores the credential under DPAPI and returns only non-secret status metadata.

### Requirement: Read DPAPI credentials without mutating ACLs
The Agent SHALL read existing version 1 DPAPI records without changing their filesystem ACL. New state directories and protected files SHALL continue to receive the restrictive LocalService, SYSTEM and Administrators ACL during creation/write. Reads SHALL fail closed for malformed records or DPAPI unprotect errors and SHALL clear temporary ciphertext and entropy buffers after unprotect completes.

#### Scenario: Existing protected credential is read by its DPAPI identity
- **WHEN** a process with file-read access reads a valid version 1 record under the DPAPI identity that protected it
- **THEN** it SHALL return the unprotected bytes to the trusted caller without invoking an ACL mutation or requiring `WRITE_DAC`.

#### Scenario: Credential record or DPAPI protection is invalid
- **WHEN** a protected record is malformed or DPAPI unprotect fails
- **THEN** the Agent SHALL reject the read without returning plaintext, modifying ACLs or weakening file permissions.

### Requirement: Authenticate Agent requests and derive runtime readiness
Agent cloud requests SHALL use credential identifier plus possession secret over TLS; API verifies the V103 verifier, lifecycle and tenant/device ownership. REAL readiness SHALL be backend-derived from an active authenticated Agent, current terminal/device relationship, matching authorized KG-verified binding and fresh REAL/kg observation. REAL_AVAILABLE is never persisted; MOCK, stale and mismatched context fail closed.

#### Scenario: Credential revocation or physical identity change
- **WHEN** an active credential is revoked or the configured logical scale identity changes
- **THEN** readiness is false; a changed physical identity requires revoke/rebind rather than retaining authorization.

### Requirement: Separate existing credential runtime authentication from pairing trust
An enrolled Agent SHALL authenticate runtime validation and observation requests with its DPAPI-protected credential and fixed API base URL; these requests SHALL NOT require pairing trust fields. Pairing start, challenge verification and envelope acceptance SHALL require the complete pinned Ed25519 trust configuration and fail closed if it is missing or invalid. Missing or rejected runtime credentials SHALL NOT trigger pairing, anonymous access or READY state.

#### Scenario: Existing credential is validated without pairing trust configuration
- **WHEN** the Agent has a DPAPI-protected credential and fixed API base URL but no pairing public key, audience or key ID
- **THEN** runtime credential validation and authenticated observations may use the API verifier, while pairing remains unavailable and no pairing request is initiated.

#### Scenario: Pairing trust is absent or invalid
- **WHEN** pairing start or envelope acceptance is requested without a pinned Ed25519 public key, audience or key ID
- **THEN** the operation fails before network or credential-persistence side effects.

### Requirement: Collect REAL scale evidence before explicit KG operator confirmation
A fresh finite REAL observation from the exact configured device, Agent installation, terminal and pending binding SHALL be valid evidence for operator confirmation even when unit is null and unverified. The UI SHALL display the numeric REAL reading as unit-unverified and SHALL NOT infer KG or stability. Confirmation remains an explicit authenticated backend action; only after success may verified-unit evidence be mirrored locally. Stale, MOCK or mismatched evidence SHALL remain blocked.

#### Scenario: ROCHI REAL protocol does not declare a unit
- **WHEN** a fresh reading is `source=REAL`, has a finite numeric weight, `unit=null`, `unitVerified=false`, and matches the current configured device and pending binding
- **THEN** the UI displays the reading as REAL with unit not verified and enables the explicit operator confirmation action without claiming that KG or stability was inferred.

### Requirement: Refresh peripheral authorization status visibly without side effects
The operator status refresh SHALL query Agent enrollment status, configured device inventory and backend authorization state without triggering pairing, physical discovery, KG confirmation or authorization writes. It SHALL show loading and a visible success or partial-failure result.

#### Scenario: Operator refreshes state
- **WHEN** the operator activates “Actualizar estado”
- **THEN** Agent, device and backend authorization views are reloaded and the UI reports completion or partial failure without changing commercial state.

### Requirement: Trace commercial capture stages without sensitive data
The Peripheral Agent SHALL emit captureId-correlated diagnostics for capture receipt, REAL read completion, local validation, observation submission/response, failure and READY confirmation. Diagnostics MAY include safe source/unit/stability/device metadata, timestamps and HTTP status, but SHALL NOT include measured weight, bodies, authorization headers, nonce, verifier or credential material. Local validation SHALL stay fail-closed and record a sanitized stage/reason code.

#### Scenario: A REAL observation is rejected locally
- **WHEN** the read source is not REAL, the unit is not kg, or unit verification is false
- **THEN** the Agent records the capture ID, local-validation stage and a safe rejection code, and returns the same rejection response without submitting an observation.

#### Scenario: The authenticated API rejects or cannot receive an observation
- **WHEN** the observation request receives a non-success HTTP response or fails due to a network error/timeout
- **THEN** the Agent records the HTTP status or safe network classification for that capture without logging response content or credentials.

#### Scenario: The API confirms READY
- **WHEN** the authenticated observation response reports `status=READY`
- **THEN** the Agent records READY for the same capture ID without logging the measurement or nonce.

### Requirement: Bound PostgreSQL work for capture readiness
Every PostgreSQL statement issued by WeightCapturePersistence.markReady SHALL run with a transaction-local statement_timeout of 1,500 ms inside the existing observation transaction. The setting SHALL end with the transaction before pool release. Cancellation SHALL use the existing READY_UPDATE logging, rollback and rethrow path without changing capture validation, atomic update, HTTP mapping or Agent timeout. If rollback fails, preserve the original error and destroy the client.

#### Scenario: PostgreSQL cancels a stalled READY statement
- **WHEN** a `markReady` statement exceeds the transaction-local statement timeout
- **THEN** PostgreSQL cancels the statement, the API emits the existing sanitized `observation.failed` event at `READY_UPDATE`, rolls back the transaction so the capture remains `PENDING`, and returns the same HTTP error semantics without a late READY update.

#### Scenario: The timeout does not leak to a later pooled request
- **WHEN** the observation transaction commits or rolls back
- **THEN** its local timeout setting is cleared before the connection is released to the pool.

#### Scenario: Rollback cannot clear the transaction-local setting
- **WHEN** rollback fails after a READY statement error
- **THEN** the API preserves the original statement error and destroys the client rather than returning an open transaction to the pool.
