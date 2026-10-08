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
A DEV_TO_QA migration-version evaluation SHALL use fresh same-operation repository and read-only QA history/schema evidence and SHALL expose only DEV_QA_SAFE_VERSION. It SHALL NOT imply PRD compatibility, global historical certification, version reservation, migration execution or production promotion. QA_TO_PRD/GLOBAL evaluation SHALL continue to require fresh PRD evidence and the separate promotion authorization gates. Historical replay, artificial history backfill, rename/renumber/overwrite and retroactive certification remain prohibited.

#### Scenario: Development version is evaluated without PRD access
- **WHEN** repository and QA evidence are verified and fresh for a DEV_TO_QA evaluation
- **THEN** the result may identify a DEV_QA_SAFE_VERSION while GLOBAL_SAFE_VERSION remains UNVERIFIED and PRD_PROMOTION_STATUS remains NOT_EVALUATED.

#### Scenario: Version evaluation is mistaken for production authorization
- **WHEN** a DEV_TO_QA version proposal is verified
- **THEN** it is not reserved and cannot authorize QA-to-PRD promotion or migration execution.

### Requirement: Persist scale authorization without historical replay
The persistence foundation SHALL use one forward-only DEV_TO_QA migration selected from fresh same-operation repository and read-only QA evidence. It SHALL support only clean DEV with both legacy tables absent and the exact known empty QA-compatible shapes, reject unknown/incompatible shapes, and SHALL NOT replay or certify historical V094/V095 or alter migration history. Persistent version reservation is unsupported; creation of the V103 migration file occupies its repository identity, and collision SHALL be re-evaluated before integration/promotion.

#### Scenario: Existing known QA tables are adopted
- **WHEN** both credential and scale-binding tables match their validated known QA shapes and contain no rows
- **THEN** the migration adds only canonical fields/constraints and creates durable capture persistence without dropping or recreating either table.

### Requirement: Persist credential verifiers and explicit KG evidence
Credential persistence SHALL contain a public identifier, verifier version/hash and lifecycle metadata, never the clear secret. A scale binding SHALL persist explicit `OPERATOR_CONFIRMATION`, displayed `kg`, confirmer and verification timestamp; `AUTHORIZED` SHALL require `KG_VERIFIED` with valid evidence. Installation ID is identity only and COM port is not logical scale identity.

#### Scenario: Credential and binding persistence is created
- **WHEN** the authorized persistence layer stores a credential or transitions a pending binding after operator confirmation
- **THEN** only the verifier is stored and KG evidence is explicit and tenant/context scoped.

### Requirement: Durable capture consumption is atomic and sale-disconnected
The persistence layer SHALL store nonce verifier/hash, exact tenant/branch/terminal/session/product/device/scale/binding context, expiry and authoritative REAL/kg/unit-verified measurement. Consumption SHALL be a single conditional transaction-safe claim that records canonical sale and consumer and returns persisted weight; no second claimant or replay succeeds. This persistence MAY support authenticated Agent/readiness endpoints, but SHALL remain disconnected from productive `SaleService` and weighted-sale POS UI until a later approved sale phase.

#### Scenario: Two transactions attempt the same capture
- **WHEN** concurrent callers claim the same valid READY capture
- **THEN** at most one conditional update returns the authoritative persisted weight, and the other caller receives no claim.

### Requirement: Pair Agent using a pinned Ed25519 trust anchor
The Node Peripheral Agent SHALL initiate enrollment directly to its fixed HTTPS API endpoint using a locally generated RSA enrollment keypair protected at rest with Windows DPAPI under the service identity. The API SHALL sign a short-lived challenge binding audience, installation/device identity, public-key fingerprint, nonce, pairing code, expiry and credential identifier with the environment Ed25519 private key. The Agent SHALL verify it with a pinned public key from trusted installer configuration. The browser SHALL NOT supply or replace the API trust key, API endpoint or Agent public key bound by the signature.

#### Scenario: Browser substitutes an enrollment key
- **WHEN** browser approval supplies a public key whose fingerprint differs from the signed Agent challenge
- **THEN** approval fails closed and no credential is issued.

### Requirement: Keep credential secret outside the renderer
The API SHALL persist only credential verifier/hash and lifecycle metadata, and SHALL encrypt the one-time credential envelope to the Agent key bound by the signed challenge. The renderer MAY relay only the signed challenge and opaque ciphertext; only the Agent decrypts and persists the secret with DPAPI. Neither private key nor plaintext Agent credential may enter renderer state, localStorage, logs, URLs or installer command lines.

#### Scenario: Agent accepts the encrypted credential
- **WHEN** the Agent receives a valid, unexpired envelope for its pending challenge
- **THEN** it stores the credential under DPAPI and returns only non-secret status metadata.

### Requirement: Authenticate Agent requests and derive runtime readiness
Agent cloud requests SHALL use credential identifier plus possession secret over TLS; API verifies the V103 verifier, lifecycle and tenant/device ownership. REAL readiness SHALL be backend-derived from an active authenticated Agent, current terminal/device relationship, matching authorized KG-verified binding and fresh REAL/kg observation. REAL_AVAILABLE is never persisted; MOCK, stale and mismatched context fail closed.

#### Scenario: Credential revocation or physical identity change
- **WHEN** an active credential is revoked or the configured logical scale identity changes
- **THEN** readiness is false; a changed physical identity requires revoke/rebind rather than retaining authorization.

### Requirement: Collect REAL scale evidence before explicit KG operator confirmation
A recent finite REAL numeric observation from the exact configured ROCHI, Agent installation, POS/operational terminal and pending binding SHALL be valid evidence for the operator confirmation step even when the device protocol reports `unit=null` and `unitVerified=false`. The UI SHALL display the numeric REAL reading and clearly state that its unit is not verified. It SHALL NOT infer KG from the model, serial frame, numeric value, COM port or physical configuration, and SHALL NOT infer stability. Confirmation SHALL remain an explicit operator action that calls the authenticated backend transition; only after a successful backend response may the UI mirror the returned `OPERATOR_CONFIRMATION` evidence into the Agent's local device metadata so later REAL observations report the verified unit. Stale, MOCK, non-finite, wrong-device, wrong-installation or mismatched-terminal/binding evidence SHALL remain blocked.

#### Scenario: ROCHI REAL protocol does not declare a unit
- **WHEN** a fresh reading is `source=REAL`, has a finite numeric weight, `unit=null`, `unitVerified=false`, and matches the current configured device and pending binding
- **THEN** the UI displays the reading as REAL with unit not verified and enables the explicit operator confirmation action without claiming that KG or stability was inferred.

### Requirement: Refresh peripheral authorization status visibly without side effects
The operator status refresh SHALL query Agent enrollment status, configured device inventory and backend authorization state without triggering pairing, physical discovery, KG confirmation or authorization writes. It SHALL show loading and a visible success or partial-failure result.

#### Scenario: Operator refreshes state
- **WHEN** the operator activates “Actualizar estado”
- **THEN** Agent, device and backend authorization views are reloaded and the UI reports completion or partial failure without changing commercial state.
