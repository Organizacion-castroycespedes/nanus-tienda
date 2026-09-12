## Purpose

Maintain a tenant-safe, cloud-authoritative and auditable relationship between a local installation, a registered physical Manus device and a logical POS terminal.

## ADDED Requirements

### Requirement: Distinct identity records
The system SHALL keep installation identity, cloud Device identity, logical Terminal identity and peripheral device identifiers distinct.

#### Scenario: Registered installation
- **WHEN** an authenticated operator registers an existing local installationId
- **THEN** the backend returns a stable cloud deviceId and does not use installationId as a credential or terminalId.

#### Scenario: Peripheral identifier
- **WHEN** a peripheral printer, scanner, scale or drawer ID is supplied to an existing peripheral operation
- **THEN** it SHALL NOT satisfy or be stored as a terminal Device identity.

### Requirement: Idempotent tenant-safe registration
The backend SHALL register the same installation once, return its stable deviceId on repetition by the same tenant, and reject attempts to claim an installation owned by another tenant.

#### Scenario: Repeat registration
- **WHEN** the same authenticated tenant registers the same installationId repeatedly
- **THEN** one cloud Device record is returned with the same deviceId and no duplicate is created.

#### Scenario: Cross-tenant registration
- **WHEN** a tenant attempts to register an installation already owned by another tenant
- **THEN** the request fails explicitly and does not alter ownership.

### Requirement: Explicit binding cardinality
The backend SHALL allow at most one ACTIVE binding for a logical Terminal and at most one ACTIVE binding for a cloud Device, and SHALL reject conflicting active binding attempts.

#### Scenario: Bind available device
- **WHEN** an active registered Device and active Terminal in the same tenant are explicitly bound
- **THEN** the backend creates an ACTIVE binding and resolves the expected terminalId and deviceId.

#### Scenario: Terminal conflict
- **WHEN** a Terminal already has an ACTIVE Device binding
- **THEN** a bind of another Device fails explicitly and the existing binding remains active.

#### Scenario: Device conflict
- **WHEN** a Device already has an ACTIVE Terminal binding
- **THEN** a bind to another Terminal fails explicitly and the existing binding remains active.

### Requirement: Replacement and audit lifecycle
The backend SHALL require explicit unbind or revoke before replacement, preserve historical bindings, and reject inactive or revoked identities.

#### Scenario: Explicit replacement
- **WHEN** an operator unbinds the old Device and binds a new Device
- **THEN** the logical Terminal identity survives, the old binding is historical, and the new binding is the sole ACTIVE binding.

#### Scenario: Revoked Device
- **WHEN** a revoked or unknown Device is used in a bind or identity resolution
- **THEN** the operation fails predictably and SHALL NOT silently operate as another Terminal.

### Requirement: Authenticated tenant authority
Binding operations SHALL derive authorization from the verified server-side JWT tenant and terminal ownership; renderer-provided tenantId SHALL NOT grant cross-tenant access.

#### Scenario: Cross-tenant bind
- **WHEN** an authenticated tenant attempts to bind a Device from another tenant to its Terminal
- **THEN** the backend rejects the request without creating a binding.

#### Scenario: Unauthorized request
- **WHEN** a request lacks a valid authenticated session or terminal write permission
- **THEN** the backend rejects it before changing Device or binding state.

### Requirement: Minimal operator state
The administration surface SHALL distinguish logical Terminal, cloud physical Device and binding status, including no device, bound, replaced/revoked and conflict outcomes.

#### Scenario: View terminal state
- **WHEN** an authorized platform administrator opens terminal administration
- **THEN** each logical Terminal displays its binding status and associated cloud device identity separately from peripheral configuration.

### Requirement: Platform administration boundary
Only the canonical `SUPER_ADMIN` role SHALL administer logical Terminals, physical TerminalDevices, Device-Terminal bindings, and terminal peripheral configuration. `SUPER_USER` and normal business roles SHALL be denied these administration routes and APIs. This boundary SHALL NOT restrict permitted operational POS peripheral execution.

#### Scenario: Non-platform administrator is denied infrastructure administration
- **WHEN** a `SUPER_USER` or normal business user requests terminal or peripheral administration directly by URL or API
- **THEN** the request is denied, regardless of the supplied `tenantId` or `terminalId`

#### Scenario: Platform administrator manages infrastructure
- **WHEN** an authenticated `SUPER_ADMIN` requests terminal, TerminalDevice, binding, or peripheral configuration administration
- **THEN** the request is authorized under the existing tenant and permission rules

#### Scenario: Browser-only runtime
- **WHEN** Web runs without an Electron bridge or local installation identity
- **THEN** it remains usable for cloud state and reports registration as unavailable without inventing a local identity.

### Requirement: P9.1 boundary preservation
The implementation SHALL preserve the P9.1 runtime contract and secure Electron boundary; identity state SHALL NOT be encoded as runtime capabilities.

#### Scenario: Runtime negotiation
- **WHEN** Web negotiates P9.1 runtime capabilities
- **THEN** capability results remain API support metadata and do not imply Device registration or Terminal binding.
