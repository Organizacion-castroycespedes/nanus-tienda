## ADDED Requirements

### Requirement: Electron uses the typed local Agent bridge
When the packaged Electron runtime exposes the approved `manusTerminal`
capability, peripheral operations SHALL use the corresponding typed IPC method
and SHALL target the fixed local Agent loopback through Electron main.

#### Scenario: Packaged health and devices
- **WHEN** authenticated Electron UI loads peripheral configuration
- **THEN** health and device requests use the typed bridge
- **AND** the UI can show the REAL Agent and persisted devices without requiring
  `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` to be public HTTPS

#### Scenario: Packaged discovery
- **WHEN** the operator requests device discovery in Electron
- **THEN** discovery uses the allowlisted typed IPC method
- **AND** no renderer fetch is made to localhost or 127.0.0.1

### Requirement: Browser transport validation remains scoped
When the approved Electron capability is absent, the browser SHALL retain its
existing Agent URL and production HTTPS validation.

#### Scenario: Pure Web production configuration
- **WHEN** a pure browser runtime uses a remote Agent URL in production
- **THEN** remote HTTP remains rejected
- **AND** remote HTTPS remains allowed according to existing configuration

### Requirement: No generic proxy primitive
The Electron handoff SHALL expose only named peripheral operations and SHALL
not expose arbitrary URLs, channels, or renderer-controlled Agent origins.

#### Scenario: Unknown peripheral path
- **WHEN** the renderer requests a path without an explicit bridge mapping
- **THEN** the operation fails closed
- **AND** no arbitrary IPC or HTTP request is attempted

### Requirement: Authenticated cloud synchronization
Local role synchronization SHALL require an authenticated user, tenant, branch,
and non-`local-terminal` operational terminal context.

#### Scenario: Valid operational context
- **WHEN** local devices contain assigned roles and the authenticated POS has
  a real operational terminal
- **THEN** the existing cloud peripheral settings endpoint receives the mapped
  role assignments
- **AND** physical device identity remains distinct from the cloud terminal ID

#### Scenario: Missing context
- **WHEN** authentication or operational context is incomplete
- **THEN** synchronization is skipped
- **AND** no cloud assignment is written

### Requirement: Persisted assignment safety
The handoff SHALL preserve existing primary-printer, drawer-parent, and
queue-only device separation semantics.

#### Scenario: Existing local inventory after restart
- **WHEN** the Agent restarts or the workstation cold-boots
- **THEN** persisted configured devices remain addressable
- **AND** the queue-only record does not become a duplicate physical assignment
