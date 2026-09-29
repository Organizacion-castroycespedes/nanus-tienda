## ADDED Requirements

### Requirement: browser safety

The system MUST keep browser `WEB` mode usable without `window.manusTerminal`, a local Peripheral Agent call, or physical-device readiness resolution.

#### Scenario: browser POS does not require Agent

- **WHEN** an authenticated user opens the POS in browser `WEB` mode without an Electron bridge
- **THEN** the Web client MUST preserve the existing cloud POS flow
- **AND** it MUST NOT call the local Agent or `POST /terminal-runtime/resolve` for physical readiness

### Requirement: tenant-scoped read-only runtime resolution

The API MUST expose `POST /terminal-runtime/resolve` as an authenticated, read-only lookup that derives the Tenant exclusively from the verified JWT context.

#### Scenario: configured Device resolves inside its JWT Tenant

- **WHEN** an authenticated request supplies a valid `installationId`
- **AND** the Device has an active binding to an active Terminal in the JWT Tenant
- **THEN** the API MUST return `CONFIGURED`
- **AND** it MUST report cloud reachability as true
- **AND** it MUST NOT register, bind, unbind, revoke, or otherwise mutate state

#### Scenario: payload Tenant cannot override JWT Tenant

- **WHEN** a request includes an untrusted Tenant override in its payload
- **THEN** the API MUST ignore that override
- **AND** it MUST resolve only against the Tenant from the verified JWT context

#### Scenario: unknown, unbound, revoked, missing, or inactive cloud state

- **WHEN** the installation identity or cloud relationship is unknown, unbound, revoked, missing, or inactive
- **THEN** the API MUST return the corresponding bounded state among `DEVICE_UNKNOWN`, `DEVICE_UNBOUND`, `DEVICE_REVOKED`, `TERMINAL_UNKNOWN`, or `TERMINAL_DISABLED`
- **AND** it MUST not create or repair a Device or binding

### Requirement: Electron runtime compatibility

Electron readiness MUST use the P9.1 runtime contract, including `getRuntimeInfo()`, `bridgeContractVersion`, `agentApiVersion`, capabilities, and `getAgentHealth()`.

#### Scenario: compatible Agent runtime

- **WHEN** Electron reports a compatible bridge and `agentApiVersion=1`
- **AND** the Agent health check is available
- **THEN** readiness MAY continue to cloud resolution
- **AND** the Web client MUST retain the advertised runtime capabilities only when compatibility is confirmed

#### Scenario: Agent unavailable or incompatible

- **WHEN** the Agent is unavailable, incompatible, or loses connectivity during readiness
- **THEN** the client MUST expose a bounded unavailable or degraded state
- **AND** it MUST NOT enable offline sales or use `installationId` as an authorization fallback

### Requirement: bounded Electron startup readiness

Electron readiness MUST combine local runtime compatibility, Agent health, authenticated cloud resolution, active Terminal state, and POS context before allowing Electron POS entry.

#### Scenario: readiness reaches configured state

- **WHEN** runtime compatibility passes
- **AND** cloud resolution returns `CONFIGURED` with `cloud.reachable=true`
- **AND** the resolved Terminal is active
- **THEN** readiness MAY report `READY`
- **AND** `canEnterPos` MAY be true only when the POS context also matches

#### Scenario: cloud or Agent unavailable

- **WHEN** cloud resolution fails or the Agent is unavailable
- **THEN** readiness MUST report a bounded `CLOUD_UNAVAILABLE` or `AGENT_UNAVAILABLE`/degraded state
- **AND** it MUST keep `canEnterPos=false`
- **AND** manual Retry MAY re-evaluate the same context without aggressive polling

### Requirement: terminal context consistency

The system MUST block Electron POS entry when the resolved Terminal differs from the existing POS session context.

#### Scenario: resolved Terminal differs from POS session

- **WHEN** a cloud-resolved Terminal does not match the Terminal in the existing POS session
- **THEN** readiness MUST report `TERMINAL_CONTEXT_MISMATCH`
- **AND** it MUST set `canEnterPos=false`
- **AND** it MUST NOT auto-switch Tenant, branch, Terminal, session, or persisted POS context

### Requirement: installation identity security boundary

The system MUST treat `installationId` only as a lookup identifier.

#### Scenario: installation identity is not authentication

- **WHEN** the client or API receives an `installationId`
- **THEN** it MUST NOT treat it as a credential, proof of possession, JWT substitute, or permission grant
- **AND** JWT authentication, Tenant isolation, permissions, and backend authorization MUST remain authoritative

#### Scenario: pairing and physical authentication remain separate

- **WHEN** the system evaluates startup readiness
- **THEN** it MUST NOT claim pairing, challenge-response, Device credentials, DPAPI, rotation, attestation, Installer authentication, or hardware certification
- **AND** those capabilities MUST remain a separate future change
