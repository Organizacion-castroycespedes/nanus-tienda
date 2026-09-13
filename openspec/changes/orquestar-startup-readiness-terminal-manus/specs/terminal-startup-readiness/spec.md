## Purpose

Define a deterministic, tenant-safe startup/readiness contract for physical Electron Manus terminals while preserving browser-only Web operation.

## ADDED Requirements

### Requirement: Execution mode boundary

The system SHALL distinguish `WEB` browser mode from `ELECTRON_TERMINAL` physical-terminal mode. Missing `window.manusTerminal` SHALL be valid in `WEB` mode and SHALL never trigger a browser localhost fallback.

#### Scenario: Browser-only Web
- **WHEN** Web runs without the Manus bridge
- **THEN** it remains eligible for its existing cloud POS flow and does not require installationId.

#### Scenario: Electron terminal
- **WHEN** Web runs in the secure Electron shell
- **THEN** it uses the physical-terminal readiness flow and typed bridge observations.

### Requirement: Local runtime composition

The system SHALL compose existing P9.1 `getRuntimeInfo()` and `getAgentHealth()` data without changing Bridge Contract V1. Local probes SHALL grant no authorization.

#### Scenario: Agent identity observation
- **WHEN** an Electron readiness probe reads Agent health
- **THEN** it may observe `agentInstallationId`, API version and health, but installationId remains lookup data and not proof of possession.

#### Scenario: Unsupported bridge
- **WHEN** bridge metadata is unsupported
- **THEN** readiness is `INCOMPATIBLE` with reason `BRIDGE_CONTRACT_UNSUPPORTED` and `canEnterPos=false`.

### Requirement: Authenticated cloud resolution

The system SHALL provide a future authenticated read-only `POST /terminal-runtime/resolve` contract accepting `{ installationId: string }`, deriving tenant from verified JWT context.

#### Scenario: Configured Device
- **WHEN** an authenticated tenant resolves an installation with an active bound Device and active Terminal
- **THEN** the API returns `resolution="CONFIGURED"`, `deviceStatus="BOUND"` and the active `terminalId` and `branchId`.

#### Scenario: Other-tenant installation
- **WHEN** a tenant submits an installationId owned by another tenant
- **THEN** the API returns generic unavailable behavior and does not reveal the other tenant, Device or binding.

#### Scenario: Read-only boundary
- **WHEN** the resolution endpoint is called
- **THEN** it does not register, bind, unbind, revoke, mutate state or authorize the caller.

### Requirement: Frozen readiness states and reasons

The system SHALL use only these top-level states: `BOOTING`, `READY`, `DEGRADED`, `NOT_CONFIGURED`, `CLOUD_UNAVAILABLE`, `INCOMPATIBLE`, `ERROR`. Detailed outcomes SHALL use the bounded reason codes defined by the P9.3 design.

#### Scenario: Cold Agent unavailable
- **WHEN** Agent is unavailable on Electron startup and no installationId was obtained in the current renderer session
- **THEN** readiness is `DEGRADED` with `AGENT_UNAVAILABLE` and `canEnterPos=false`.

#### Scenario: Agent loss after identity acquisition
- **WHEN** the same renderer session previously obtained installationId and configured cloud resolution, then Agent becomes unavailable
- **THEN** the orchestrator may use volatile in-memory identity, re-resolve cloud state, and return `DEGRADED/AGENT_UNAVAILABLE` with `canEnterPos=true` only while resolution remains configured.

#### Scenario: Cloud unavailable
- **WHEN** Web cannot reach the authenticated API/cloud
- **THEN** readiness is `CLOUD_UNAVAILABLE` with `canEnterPos=false` and no offline sales authority is enabled.

#### Scenario: Device configuration failure
- **WHEN** resolution is `DEVICE_UNKNOWN`, `DEVICE_UNBOUND`, `DEVICE_REVOKED`, `TERMINAL_UNKNOWN` or `TERMINAL_DISABLED`
- **THEN** readiness is `NOT_CONFIGURED` with the matching reason and `canEnterPos=false`.

#### Scenario: Unsupported Agent API
- **WHEN** the Agent API is unsupported for the required hardware runtime
- **THEN** readiness is `INCOMPATIBLE` with `AGENT_API_UNSUPPORTED` and physical-terminal entry is blocked.

### Requirement: Readiness composition and POS gate

Web SHALL compose local observations and cloud resolution. Readiness SHALL be an operational entry gate and SHALL NOT replace server-side authentication or authorization.

#### Scenario: POS Terminal context mismatch
- **WHEN** Electron cloud resolution is configured for Terminal A and an existing POS session is selected for Terminal B
- **THEN** readiness is `NOT_CONFIGURED` with `TERMINAL_CONTEXT_MISMATCH`, `canEnterPos=false`, and no session or stored context is changed automatically.

#### Scenario: No existing POS session
- **WHEN** Electron cloud resolution is configured but no POS session Terminal exists yet
- **THEN** readiness does not report `TERMINAL_CONTEXT_MISMATCH`; existing context/session selection remains responsible for choosing a session.

#### Scenario: Fully configured terminal
- **WHEN** Electron, a supported bridge, authenticated cloud, an active Device binding and an active Terminal are available
- **THEN** readiness is `READY` and Electron POS entry is allowed.

#### Scenario: Optional capability unavailable
- **WHEN** an optional configured peripheral capability is unavailable
- **THEN** POS is not globally blocked; readiness may be `READY` or `DEGRADED` with `OPTIONAL_CAPABILITY_MISSING`.

### Requirement: Controlled re-evaluation

The system SHALL re-evaluate at Web startup, successful authentication, Electron POS entry, manual Retry, Agent health recovery and detectable local runtime changes. It SHALL avoid aggressive polling and websocket/push infrastructure.

#### Scenario: Remote binding change
- **WHEN** an administrator changes a binding remotely
- **THEN** the next readiness evaluation observes the new cloud result; the system does not claim immediate push invalidation.

#### Scenario: Retry
- **WHEN** the operator selects Retry after a transient failure
- **THEN** local and cloud checks run again with bounded retry behavior.

### Requirement: Scope and security invariants

P9.3 SHALL preserve secure typed bridge boundaries, cloud authority, administration-versus-runtime separation and the distinction between TerminalDevice and peripheral devices.

#### Scenario: No local privilege expansion
- **WHEN** readiness information is exposed to Web
- **THEN** it contains no generic IPC, arbitrary localhost proxy, renderer-controlled Agent URL, filesystem access, command execution or secret.

#### Scenario: Business runtime permissions
- **WHEN** a business user operates normal POS runtime flows
- **THEN** readiness does not convert operational peripheral permissions into SUPER_ADMIN-only administration permissions.

#### Scenario: Out-of-scope offline behavior
- **WHEN** cloud is unavailable
- **THEN** the system does not enable offline sales, transactional local cache or local business-state authority.
