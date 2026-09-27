## Purpose

Define a safe, on-demand commercial weighing capability between Manus POS and the authorized Peripheral Agent, reusing the existing product sale model and excluding metrological certification.

## ADDED Requirements

### Requirement: Administrative credential records never issue secrets

The system SHALL persist only a public credential identifier and a versioned SHA-256 verifier for an active Agent installation; it SHALL NOT issue or return the bearer token.

#### Scenario: Credential record is registered
- **WHEN** an authorized administrator registers a credential record for an active Agent installation
- **THEN** the API SHALL store no recoverable token and SHALL return no verifier or secret.

### Requirement: SCALE binding is tenant and terminal scoped

The backend SHALL require the same tenant and branch across the POS terminal, operational terminal, Agent installation and active Agent-terminal binding.

#### Scenario: Cross-scope binding is rejected
- **WHEN** any terminal, branch, Agent or device belongs to another tenant or branch
- **THEN** the binding SHALL be rejected transactionally.

### Requirement: Administrative records do not enable REAL weighing

An administrative credential or SCALE binding SHALL NOT establish physical possession or authorize a commercial weight capture.

#### Scenario: Binding without Agent evidence remains blocked
- **WHEN** a credential or SCALE binding exists without authenticated Agent evidence and KG verification
- **THEN** POS SHALL retain `UNKNOWN` or pending state and SHALL NOT expose `REAL_AVAILABLE` or add a weight.

### Requirement: Product sale mode governs weighing

The system SHALL reuse the existing product `saleType` and `measurementUnit` values without creating a second product model.

#### Scenario: Unit product does not require a scale
- **WHEN** a product has `saleType=UNIT` and `measurementUnit=UND`
- **THEN** POS SHALL allow normal unit sales without requiring a configured or connected scale.

#### Scenario: Weight product requests weighing
- **WHEN** a product has `saleType=WEIGHT` and a valid weight measurement unit
- **THEN** POS SHALL require an approved weighing flow before accepting its physical quantity.

#### Scenario: Unit-and-weight product chooses a mode
- **WHEN** a product has `saleType=BOTH`
- **THEN** POS SHALL show an explicit Unidad/Peso choice before applying quantity; Unidad SHALL reuse the existing unit add flow, while Peso SHALL enter the contextual weighing flow and SHALL NOT add a MOCK quantity.

#### Scenario: BOTH mode selection is cancelled
- **WHEN** the operator closes the Unidad/Peso choice without selecting a mode
- **THEN** POS SHALL leave the cart and sale state unchanged.

#### Scenario: Invalid product model
- **WHEN** a product has an invalid sale type and measurement unit combination
- **THEN** the commercial weighing flow SHALL reject it and SHALL NOT infer a mode from legacy flags.

### Requirement: Terminal scale availability is explicit

The system SHALL resolve scale availability from the authorized tenant, branch and terminal configuration and SHALL distinguish configuration, enablement, device identity and connection state.

#### Scenario: Terminal has no scale assigned
- **WHEN** the active terminal has no assigned scale device
- **THEN** POS SHALL hide permanent scale indicators, connection status, live weight, scale panels and scale-only controls, and SHALL continue allowing unit sales.

#### Scenario: Weight is attempted without a scale
- **WHEN** the operator selects a `WEIGHT` sale or the weight mode of a `BOTH` product on a terminal without an assigned and enabled scale
- **THEN** POS SHALL show only a contextual explanation, SHALL NOT show a permanent scale indicator, and SHALL block REAL capture.

#### Scenario: Scale is disabled
- **WHEN** the terminal has a scale assignment but scale use is disabled
- **THEN** POS SHALL hide permanent scale indicators and controls, SHALL keep unit sales available, and SHALL show only a contextual explanation if a weighted operation is attempted.

#### Scenario: Scale is configured and available
- **WHEN** the terminal has an enabled authorized scale and the Agent reports it available
- **THEN** POS SHALL show only the state supported by the effective configuration and Agent contract; a commercial capture remains blocked until the REAL Agent capture contract is implemented and verified.

#### Scenario: Scale is disconnected or in error
- **WHEN** the assigned device is disconnected, occupied, or reports a transport/parser error
- **THEN** POS SHALL show a distinct unavailable state and SHALL NOT reuse a previous reading.

#### Scenario: Configuration lookup fails
- **WHEN** the terminal configuration cannot be resolved
- **THEN** the commercial flow SHALL fail closed, SHALL hide operational scale controls, and SHALL NOT activate `FALLBACK_MOCK` for a weighted sale.

#### Scenario: Configuration is revoked during capture
- **WHEN** scale assignment or enablement is revoked before confirmation of a weight sale
- **THEN** the capture SHALL be invalidated and the sale SHALL be blocked until configuration is resolved.

### Requirement: Weight capture is real, fresh, and attributable

The weighing flow SHALL return a normalized kilogram value together with explicit source, configured source unit, capture time, freshness, terminal and device attribution; it SHALL NOT use the MOCK stability flag as metrological evidence.

#### Scenario: Verified KG capture
- **WHEN** the configured ROCHI unit is explicitly verified as KG and the Agent returns a fresh REAL reading
- **THEN** POS SHALL receive the normalized kilogram value and SHALL associate it with the active terminal, product and operation.

#### Scenario: Unit is not verified
- **WHEN** the physical unit is unknown, changed, or inconsistent with configuration
- **THEN** the Agent/POS flow SHALL show `Unidad no verificada` and SHALL reject commercial capture.

#### Scenario: Stale or invalid reading
- **WHEN** the reading is stale, missing, malformed, non-positive where the product policy rejects it, or invalidated by close/error/disconnect
- **THEN** the flow SHALL reject it and SHALL clear any prior usable reading.

#### Scenario: MOCK reading in a commercial flow
- **WHEN** the response source is MOCK or fallback simulation
- **THEN** it SHALL be visibly labeled as simulated and SHALL NOT satisfy a REAL commercial weighing requirement.

#### Scenario: Configured terminal points to the documented MOCK fixture
- **WHEN** terminal configuration resolves as `CONFIGURED` but `scaleDeviceId` is the documented `mock-scale-001` fixture
- **THEN** POS SHALL hide permanent scale UI and SHALL NOT treat the assignment as evidence of a physical REAL scale.

#### Scenario: No metrological stability flag
- **WHEN** ROCHI provides a valid frame without a stability indicator
- **THEN** the system SHALL NOT infer metrological stability from repeated values or from `stable=true` in the MOCK contract.

#### Scenario: Capture unit is KG verified
- **WHEN** the operator has verified the ROCHI physical unit as KG before the capture
- **THEN** the flow SHALL permit the capture only with source `REAL` and SHALL normalize the result to kilograms.

#### Scenario: Capture unit is doubtful
- **WHEN** the physical unit is doubtful, changed, or cannot be verified as KG
- **THEN** the flow SHALL show `Unidad no verificada` and SHALL block commercial capture without claiming automatic KG/LB detection.

### Requirement: Capture lifecycle is controlled

The system SHALL use one explicit on-demand capture or bounded weighing session per terminal and device, with cancellation, freshness limits and cleanup on every exit path.

#### Scenario: Single capture succeeds
- **WHEN** POS requests a reading for the active weighing operation
- **THEN** the Agent SHALL open the authorized connection, synchronize, obtain one fresh reading, return it, and close the connection for that operation.

#### Scenario: Concurrent capture is attempted
- **WHEN** a second capture starts while the same terminal/device capture is active
- **THEN** the second request SHALL be rejected or serialized according to the approved contract, and SHALL NOT create a second uncontrolled serial owner.

#### Scenario: Timeout or cancellation
- **WHEN** synchronization, reading, operator confirmation, or Agent response exceeds its limit or is cancelled
- **THEN** the operation SHALL close safely, invalidate the reading, and return a distinguishable timeout/cancelled result.

#### Scenario: USB or transport loss
- **WHEN** the physical connection is lost during capture
- **THEN** the Agent SHALL transition to a disconnected/error state, invalidate the current reading immediately, and SHALL require an explicit later recovery.

#### Scenario: Temporary session is not first-phase behavior
- **WHEN** a single commercial weight operation is executed in the first phase
- **THEN** the Agent SHALL NOT keep a permanent or reusable scale connection after the capture; a temporary session SHALL require a later approved evolution.

### Requirement: Commercial sale reuses authoritative pricing and inventory

The system SHALL reuse the existing pricing preview, sale, tax, discount and inventory flows, while backend validation remains authoritative for quantity and weighing evidence.

#### Scenario: Weight enters the existing cart flow
- **WHEN** a valid capture is accepted for a weight sale
- **THEN** POS SHALL apply the quantity through the existing cart and pricing-preview flow without duplicating price or tax calculation.

#### Scenario: Backend receives a weighted sale
- **WHEN** a weighted sale is submitted
- **THEN** backend SHALL revalidate tenant, branch, terminal, product sale mode, measurement unit, quantity, price rules and required capture evidence before confirming the sale.

#### Scenario: Capture evidence is missing or mismatched
- **WHEN** evidence is absent, duplicated, expired, belongs to another terminal/product/operation, or is MOCK where REAL is required
- **THEN** backend SHALL reject the weighted sale without partial inventory or fiscal persistence.

#### Scenario: Normal unit sale remains compatible
- **WHEN** a unit product is sold without a scale
- **THEN** the existing pricing, tax, discount, inventory and invoicing behavior SHALL continue unchanged.

### Requirement: Manual quantity is not a silent scale substitute

The system SHALL preserve existing manual quantity controls for approved unit operations and SHALL require an explicit approved policy for any manual override of a weight sale.

#### Scenario: Manual quantity for unit sale
- **WHEN** the operator edits quantity for a `UNIT` product
- **THEN** the existing unit quantity behavior SHALL remain available.

#### Scenario: Manual quantity for required weight sale
- **WHEN** the operator enters a quantity manually for a `WEIGHT` sale without an approved override
- **THEN** POS and backend SHALL reject the operation, SHALL NOT fall back to MOCK, and SHALL NOT label it as a physical scale capture.

#### Scenario: Manual quantity for unit mode of BOTH
- **WHEN** the operator selects unit mode for a `BOTH` product
- **THEN** the existing manual unit quantity behavior SHALL remain available without a scale.

#### Scenario: Manual quantity for weight mode of BOTH
- **WHEN** the operator selects weight mode for a `BOTH` product
- **THEN** POS and backend SHALL require a REAL physical capture and SHALL reject manual quantity as a substitute.

### Requirement: Short-lived authorization protects capture ownership

The system SHALL require a backend-issued short-lived authorization bound to tenant, applicable branch, terminal, POS session, product, operation and configured device before a REAL capture.

#### Scenario: Authorized capture
- **WHEN** the backend issues a non-expired authorization for the active terminal and configured device
- **THEN** the Agent SHALL corroborate that authorization with its local device and terminal configuration before returning a REAL reading.

#### Scenario: Frontend identity alone
- **WHEN** a request supplies only frontend-controlled `terminalId` or `deviceId`
- **THEN** the Agent/backend SHALL reject the request as insufficient proof of ownership.

#### Scenario: Authorization expires or is revoked
- **WHEN** the authorization expires, is consumed, or terminal/device configuration is revoked
- **THEN** the capture SHALL be rejected and SHALL NOT be recoverable by replaying the same authorization.

### Requirement: Capture evidence is transient and single-use

The system SHALL carry capture evidence transiently through the commercial operation with expiry, source `REAL`, verified unit `KG`, normalized value, capture time, device, terminal, product, operation and unique identity; backend SHALL consume it atomically with the sale.

#### Scenario: Evidence matches operation
- **WHEN** evidence matches the authenticated tenant, terminal, POS session, product and selected weight mode and is within its TTL
- **THEN** backend SHALL consume it once and SHALL allow the existing pricing, tax, inventory and sale transaction to continue.

#### Scenario: Evidence is duplicated or mismatched
- **WHEN** evidence is duplicated, expired, consumed, MOCK, or belongs to another terminal, product, session or operation
- **THEN** backend SHALL reject the weighted sale without partial commercial persistence.

### Requirement: Tenant and terminal isolation is enforced

The system SHALL bind configuration and capture evidence to the authorized tenant, branch, active terminal, registered device and current POS operation.

#### Scenario: Cross-tenant device request
- **WHEN** a request references a device or terminal outside the authorized tenant or branch
- **THEN** the Agent/backend SHALL reject it.

#### Scenario: Terminal changes during capture
- **WHEN** the active POS terminal changes while a capture is pending
- **THEN** the pending capture SHALL be invalidated and SHALL NOT be reused by the new terminal.

#### Scenario: Untrusted client-supplied identity
- **WHEN** the only proof of device or capture ownership is an identifier supplied by the frontend
- **THEN** the backend/Agent SHALL reject it unless it is corroborated by the existing authorized configuration and local trust mechanism.

### Requirement: Contra Muslo acceptance fixture is explicit

The implementation SHALL support acceptance testing with an explicit fixture named `Contra Muslo`, reported as `saleType=BOTH` and `measurementUnit=KG`, without changing or assuming its catalog price, stock or quantity.

#### Scenario: Contra Muslo unit mode
- **WHEN** the fixture is selected in unit mode on a terminal without a scale
- **THEN** POS SHALL keep the existing unit cart, pricing, tax and inventory flow operational.

#### Scenario: Contra Muslo weight mode with authorized ROCHI
- **WHEN** the fixture is selected in weight mode on a terminal with an enabled authorized ROCHI and verified KG
- **THEN** POS SHALL request one REAL capture and SHALL send its accepted normalized quantity through the existing pricing flow.

#### Scenario: Contra Muslo weight mode without scale
- **WHEN** the fixture is selected in weight mode on a terminal without an assigned and enabled scale
- **THEN** POS SHALL show only a contextual warning, SHALL keep unit mode available, and SHALL block REAL capture.

#### Scenario: Contra Muslo invalid capture
- **WHEN** the fixture receives stale, disconnected, doubtful-unit, duplicated or expired evidence
- **THEN** POS/backend SHALL reject weight confirmation and SHALL clear or invalidate the unusable reading.

### Requirement: SCALE identity is distinct from terminal configuration

The system SHALL distinguish commercial tenant, branch, terminal, Agent installation, logical SCALE device and physical ROCHI identity. A non-empty `scaleDeviceId`, `source=CONFIGURED` or `features.scale=true` SHALL NOT prove REAL hardware or connection.

#### Scenario: Configuration points to the documented MOCK fixture
- **WHEN** `scaleDeviceId=mock-scale-001` is resolved for an otherwise configured terminal
- **THEN** POS SHALL classify the assignment as MOCK for commercial visibility, hide permanent physical-scale UI and SHALL NOT permit REAL capture.

#### Scenario: REAL device is registered but disconnected
- **WHEN** a SCALE is registered and authorized for the terminal but the Agent reports no physical connection
- **THEN** the system SHALL expose a distinct disconnected state and SHALL reject capture without reusing a previous reading.

#### Scenario: Device belongs to another tenant, branch or terminal
- **WHEN** a request references a SCALE or Agent installation outside the authorized ownership boundary
- **THEN** backend and Agent SHALL reject it before opening a physical connection.

#### Scenario: Installation is revoked
- **WHEN** the Agent installation, binding or SCALE assignment is revoked
- **THEN** pending authorizations and captures SHALL be invalidated and the POS SHALL fail closed.

### Requirement: Current-terminal resolution is additive and fail-closed

The additive `scale` block of `/pos-terminals/resolve-current` SHALL preserve existing fields and SHALL distinguish administrative assignment from conservative MOCK/UNKNOWN classification. Agent-verified physical state is not implemented by this phase.

#### Scenario: Configuration is known but origin is unknown
- **WHEN** resolution returns terminal configuration without reliable REAL/MOCK origin or Agent proof
- **THEN** POS SHALL use a neutral or unavailable state and SHALL NOT show physical readiness or enable commercial capture.

#### Scenario: Non-MOCK assignment is conservatively classified
- **WHEN** an authorized terminal has an assigned SCALE different from the documented MOCK fixture but no Agent proof is available
- **THEN** `resolve-current` SHALL return `assignment=ASSIGNED` and `classification=UNKNOWN`, and POS SHALL not treat it as REAL availability.

#### Scenario: Terminal or session changes
- **WHEN** the active terminal or POS session changes while configuration or capture data is pending
- **THEN** stale state and pending authorization SHALL be discarded and SHALL NOT be reused by the new context.

### Requirement: Agent binding precedes REAL authorization

The system SHALL require corroboration between the authorized terminal, Agent installation, logical SCALE and physical ROCHI identity before issuing or accepting a short-lived REAL capture authorization.

#### Scenario: Frontend supplies identifiers only
- **WHEN** a request contains only frontend-controlled `terminalId`, `deviceId` or `installationId`
- **THEN** the request SHALL be rejected as insufficient proof of ownership.

#### Scenario: Authorization expires or is replayed
- **WHEN** a short-lived authorization is expired, revoked, consumed or replayed
- **THEN** the Agent/backend SHALL reject it and SHALL not open the serial connection.

#### Scenario: Local physical configuration is incomplete
- **WHEN** PnP/port identity, Agent binding or KG verification is absent or inconsistent
- **THEN** the system SHALL report a safe unavailable or `Unidad no verificada` state and SHALL block REAL capture.

### Requirement: Registration separates administrative and local physical data

The administrative record SHALL own tenant, branch, terminal, logical device, enablement, mode and revocation. The Agent SHALL own local COM/PnP discovery, serial parameters, connection lifecycle and physical KG verification; COM3 SHALL NOT be a mandatory global business identifier.

#### Scenario: Administrative assignment is valid but local Agent is absent
- **WHEN** a terminal has an enabled SCALE assignment but no corroborating Agent installation or physical device
- **THEN** POS SHALL keep unit sales available, SHALL not show physical readiness and SHALL block weighted capture.

#### Scenario: Local device is discovered for another terminal
- **WHEN** the Agent discovers a physical SCALE whose authorized binding is for another terminal
- **THEN** the Agent/backend SHALL reject the use and SHALL not expose its reading to the active POS.

### Requirement: Agent installation trust precedes SCALE binding

The system SHALL distinguish the cloud Agent installation, the commercial terminal, the logical SCALE assignment and the physical ROCHI device. An identifier supplied by POS, WEB or Electron SHALL NOT authenticate any of them by itself.

#### Scenario: Unauthenticated local request
- **WHEN** a local HTTP, WebSocket or Electron request contains only `terminalId`, `deviceId`, `installationId`, COM, PnP, USB or SERIAL data
- **THEN** the Agent/backend SHALL reject the request as insufficient proof and SHALL keep the scale state `UNKNOWN` or unavailable.

#### Scenario: Authorized installation binding
- **WHEN** an authenticated Agent installation is bound to an active terminal in the same tenant and branch and the logical SCALE assignment matches
- **THEN** the backend MAY expose the binding as pending verification, but SHALL NOT expose physical availability until the Agent provides a recent corroborated observation.

#### Scenario: Cross-tenant or cross-branch binding
- **WHEN** an installation, terminal or SCALE belongs to another tenant, branch or terminal
- **THEN** the backend SHALL reject the binding and SHALL not expose device data to POS.

### Requirement: Administrative detection and revocation are explicit

The administrative flow SHALL support the ordered states Detectar, Probar, Vincular, Habilitar and Revocar using authorized permissions and existing peripheral onboarding where possible.

#### Scenario: Physical detection is requested
- **WHEN** an authorized operator requests detection or test
- **THEN** the Agent SHALL perform the local discovery and communication test, while COM/PnP and serial parameters remain local; a declaration alone SHALL not create REAL availability.

#### Scenario: KG is not verified
- **WHEN** the operator has not explicitly verified the ROCHI physical unit as KG
- **THEN** the system SHALL report `UNIT_NOT_VERIFIED` and SHALL block REAL capture without inferring the unit from frames.

#### Scenario: Binding is revoked or changes terminal
- **WHEN** an Agent binding, SCALE assignment or terminal context is revoked or changed
- **THEN** pending availability observations and future capture authorizations SHALL be invalidated immediately.

### Requirement: Availability is authenticated and expiring

The system SHALL expose physical availability only from an authenticated Agent observation bound to the authorized installation, terminal and logical SCALE, with timestamp and expiry.

#### Scenario: Local channel has only CORS protection
- **WHEN** the Agent can validate origin or loopback but cannot authenticate the installation and request binding
- **THEN** the system SHALL keep the device `UNKNOWN` or unavailable and SHALL not issue `REAL_AVAILABLE`.

#### Scenario: Observation expires or disconnects
- **WHEN** the Agent observation exceeds its TTL, reports disconnect/error, or the local device changes
- **THEN** the system SHALL invalidate availability and SHALL not reuse a previous observation or reading.

#### Scenario: MOCK remains isolated
- **WHEN** the assigned device is `mock-scale-001` or another explicitly classified MOCK fixture
- **THEN** the system SHALL preserve MOCK classification and SHALL not use detection success or `stable=true` to authorize REAL weighing.

### Requirement: Agent credentials are installation-scoped and revocable

The system SHALL use a high-entropy credential unique to the Agent installation for authenticated Agent operations. The backend SHALL store only an approved verifier, SHALL bind the credential to the tenant and `terminal_devices` installation, and SHALL never treat `installationId`, CORS, loopback, `terminalId`, `deviceId`, COM, PnP, USB or SERIAL as authentication by themselves.

#### Scenario: Credential enrollment
- **WHEN** an authorized administrator enrolls an Agent installation
- **THEN** the backend SHALL issue a one-time credential through an approved protected channel, store only its verifier and audit the issuance; WEB and the Electron renderer SHALL not receive a reusable long-lived secret.

#### Scenario: Authenticated Agent request
- **WHEN** an Agent calls a protected operation
- **THEN** the request SHALL prove credential, installation, audience, operation, nonce and freshness, and the backend SHALL validate tenant, terminal binding and credential status before accepting it.

#### Scenario: Replay or revoked credential
- **WHEN** a nonce is reused, a credential is expired or revoked, or the installation is unbound
- **THEN** the backend and Agent SHALL reject the request and SHALL not expose physical availability or open the serial connection.

#### Scenario: Credential rotation or reinstall
- **WHEN** an installation rotates its credential or is reinstalled
- **THEN** the previous credential SHALL expire or be revoked within the approved transition window, the new credential SHALL be bound to one installation, and old requests SHALL remain invalid.

### Requirement: Agent and SCALE binding is persistent and tenant-safe

The system SHALL persist a binding between tenant, branch, commercial terminal, authenticated Agent installation and logical SCALE without treating the local `PeripheralDevice` JSON as a cloud foreign key. The binding SHALL reject cross-tenant ownership, inactive terminals, revoked installations and duplicate active assignments.

#### Scenario: Binding is created
- **WHEN** an authorized administrator binds an authenticated Agent and logical SCALE to an active terminal in the same tenant and branch
- **THEN** the backend SHALL create one active binding transactionally and SHALL preserve `COM`, PnP and serial parameters only in the Agent local configuration.

#### Scenario: Double or cross-tenant binding
- **WHEN** a terminal, Agent installation or logical SCALE already has an incompatible active binding, or belongs to another tenant or branch
- **THEN** the backend SHALL reject the operation without partial persistence or exposure to POS.

#### Scenario: Binding is revoked or replaced
- **WHEN** an administrator revokes or replaces the Agent, terminal or SCALE binding
- **THEN** pending observations and future authorizations SHALL be invalidated immediately, and `resolve-current` SHALL remain conservative until a new authenticated observation exists.

### Requirement: Physical observation is separate from authentication

The system SHALL distinguish authenticated Agent identity, administrative binding, local ROCHI communication, KG verification and commercial capture authorization. A valid credential or binding SHALL not by itself produce `REAL_AVAILABLE`.

#### Scenario: Authenticated physical probe
- **WHEN** an authenticated Agent probes the bound logical SCALE using the existing ROCHI driver and the operator explicitly verifies KG
- **THEN** the backend MAY record a time-limited observation containing logical device, request nonce, timestamp, unit state and safe status, without storing COM as global identity.

#### Scenario: Probe is stale or incomplete
- **WHEN** the probe exceeds its TTL, the Agent reports disconnect/error, the USB identity changes, or KG is not verified
- **THEN** the system SHALL invalidate availability and SHALL expose `UNKNOWN`, `DISCONNECTED`, `ERROR` or `UNIT_NOT_VERIFIED` as appropriate; it SHALL not expose `REAL_AVAILABLE`.

### Requirement: WEB and Electron use authenticated transport boundaries

Electron SHALL use the existing typed bridge without exposing the Agent credential to the renderer. WEB SHALL not enable REAL Agent operations through loopback or CORS alone; it SHALL require an approved one-time challenge handshake or remain unavailable.

#### Scenario: Local request has only origin controls
- **WHEN** a browser request reaches the Agent with an allowed origin or loopback address but without valid Agent proof
- **THEN** the Agent SHALL reject protected operations and the POS SHALL retain `UNKNOWN` or unavailable state.

#### Scenario: Electron renderer supplies identifiers only
- **WHEN** the renderer supplies only `terminalId`, `deviceId` or `installationId`
- **THEN** the main process and backend SHALL reject the operation as insufficient proof and SHALL not open ROCHI.

