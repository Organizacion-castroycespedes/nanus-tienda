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

### Requirement: Local device registry persistence
The Agent SHALL persist configured local devices in the platform state
directory using a versioned, atomic registry store. The Agent SHALL separate
configured device state from runtime connectivity state.

#### Scenario: NETWORK device survives restart
- **WHEN** a NETWORK printer is registered locally and the Agent restarts
- **THEN** `GET /devices` SHALL still include the configured printer
- **AND** the Agent SHALL restore its saved configuration without requiring
  re-registration

#### Scenario: Offline configured device remains configured
- **WHEN** a configured device cannot currently be reached
- **THEN** the Agent SHALL keep the device in the registry
- **AND** it SHALL update only the runtime status to `NOT_REACHABLE` or
  `DISCONNECTED`
- **AND** it SHALL NOT delete the configured device

#### Scenario: Missing or corrupt state file
- **WHEN** the registry file is missing
- **THEN** the Agent SHALL boot with an empty configured registry
- **WHEN** the registry file is corrupt
- **THEN** the Agent SHALL report a controlled error and continue running

#### Scenario: Configured and discovered USB device
- **WHEN** a configured USB printer is rediscovered by hardware discovery
- **THEN** the Agent SHALL reconcile the entries deterministically
- **AND** it SHALL NOT create duplicate logical devices for the same printer

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

### Requirement: CORS allow-list and preflight
The Agent SHALL bind to `127.0.0.1` and SHALL only allow browser origins that
are explicitly configured in its local allow-list or environment override.
The Agent SHALL respond to printer preflight requests only for authorized
origins.

#### Scenario: Allowed printer preflight
- **WHEN** a configured browser origin sends `OPTIONS /printer/print-ticket`
  with `Access-Control-Request-Method: POST`
- **THEN** the Agent SHALL return `204` or `200`
- **AND** the response SHALL include the authorized origin
- **AND** `Access-Control-Allow-Methods` SHALL include `POST` and `OPTIONS`
- **AND** `Access-Control-Allow-Headers` SHALL include `content-type`

#### Scenario: Disallowed printer preflight
- **WHEN** an unapproved origin sends the same printer preflight request
- **THEN** the Agent SHALL reject the origin
- **AND** it SHALL NOT advertise `Access-Control-Allow-Origin: *`

### Requirement: Windows x64 portable autostart
The project SHALL include idempotent Scheduled Task scripts for the portable
Windows x64 Agent. The task SHALL start the Agent from the installed portable
folder, avoid duplicate instances on port `4050`, support a short startup
delay, and expose task registration status without secrets.

#### Scenario: Scheduled Task lifecycle
- **WHEN** the operator runs `install-agent-autostart.ps1`
- **THEN** the task SHALL be registered or refreshed with `Register-ScheduledTask`
- **AND** the task SHALL launch the portable installation after logon
- **AND** the task SHALL use restart-on-failure settings
- **AND** `remove-agent-autostart.ps1` SHALL remove the task safely if present
- **AND** `status-agent-autostart.ps1` SHALL report registered, running and
  last result information

#### Scenario: Quoted launcher entry point
- **WHEN** the autostart launcher starts the Agent from a portable path with
  spaces
- **THEN** it SHALL pass the entry point as a quoted argument
- **AND** it SHALL bootstrap `PERIPHERALS_CONFIG_PATH` before process start
- **AND** it SHALL only return success after the health gate responds `200`
