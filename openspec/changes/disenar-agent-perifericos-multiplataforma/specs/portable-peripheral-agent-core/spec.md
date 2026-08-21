## ADDED Requirements

### Requirement: Portable Agent core
The Peripheral Agent SHALL keep HTTP, WebSocket, jobs, configuration, logs,
health, normalized errors, profiles and ESC/POS rendering free from
Windows-specific imports and runtime calls.

#### Scenario: Core print request
- **WHEN** a printer job reaches the portable core
- **THEN** the core SHALL render the canonical document and invoke a transport
  interface without importing Winspool, PowerShell or a platform path

### Requirement: Windows RAW adapter isolation
The Agent SHALL isolate Windows spooler RAW behavior and Windows queue discovery
inside Windows platform adapters.

#### Scenario: XP-80 Windows RAW
- **WHEN** the configured Windows XP-80 USB device receives a thermal ticket
- **THEN** the Windows adapter SHALL send common ESC/POS bytes to its
  discovered queue and preserve the certified CUT sequence

### Requirement: Portable printer transports
The Agent SHALL expose a printer transport abstraction. TCP RAW SHALL remain
portable and SHALL not depend on the local operating system.

#### Scenario: Network RAW
- **WHEN** a NETWORK printer is configured with host, port and timeout
- **THEN** the TCP RAW transport SHALL send common ESC/POS bytes through a
  socket independently of platform

### Requirement: Portable device descriptor
The Agent SHALL expose `agentInstallationId`, `deviceId`, `nativeIdentifier`,
`fingerprint`, `platform` and `architecture` in a portable device descriptor
without requiring a vendor-specific identifier.

#### Scenario: Legacy USB identity
- **WHEN** a previously discovered USB queue has only its legacy identity
- **THEN** the Agent SHALL preserve its existing `deviceId` while supplying
  additive descriptor fields

### Requirement: Platform paths
The Agent SHALL resolve config, state and log directories through a platform
paths abstraction. Portable core code SHALL NOT hardcode Windows locations.

#### Scenario: Local state path
- **WHEN** an Agent needs local installation state
- **THEN** it SHALL request the platform paths abstraction rather than compose
  a Windows-only location

### Requirement: Windows x64 portable QA artifact
The project SHALL produce a reproducible Windows x64 portable Agent artifact
for P0 that runs without global Node, npm or Git on the POS workstation.

#### Scenario: Local remote-Web QA
- **WHEN** the artifact runs on a Windows x64 workstation
- **THEN** it SHALL bind to `127.0.0.1:4050` by default, load only allow-listed
  non-secret local configuration, persist local Agent state, and permit only
  configured Browser origins

#### Scenario: Portable startup validation
- **WHEN** the packaged launcher starts the Agent through its embedded runtime
- **THEN** `GET /health` and `POST /devices/discover` SHALL succeed before the
  process accepts a clean shutdown signal
