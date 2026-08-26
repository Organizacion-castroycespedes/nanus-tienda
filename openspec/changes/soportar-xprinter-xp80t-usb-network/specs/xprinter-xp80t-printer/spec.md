## ADDED Requirements

### Requirement: Register printer by connection
The system SHALL allow a `PRINTER` to be registered with `connectionType`
`NETWORK` or `USB` while preserving common `id`, `name`, `terminalId` and
`profileId` fields.

#### Scenario: Register NETWORK printer
- **WHEN** an administrator submits a `PRINTER` with `connectionType: NETWORK`
- **THEN** the agent SHALL validate and retain the common printer fields and NETWORK configuration

#### Scenario: Register USB printer
- **WHEN** an administrator submits a `PRINTER` with `connectionType: USB`
- **THEN** the agent SHALL validate and retain the common printer fields and its discovered USB association without requiring NETWORK fields

### Requirement: Network printer configuration
For `connectionType: NETWORK`, the system SHALL require `host` and `port` and
SHALL accept configurable `timeoutMs` within its validation range.

#### Scenario: Reject missing network host
- **WHEN** a NETWORK printer is registered without `network.host`
- **THEN** the agent SHALL reject the request with a controlled validation error

#### Scenario: Use configured network timeout
- **WHEN** a NETWORK test print is sent to a configured printer
- **THEN** the agent SHALL use that printer's configured timeout for the TCP connection

### Requirement: USB printer configuration and discovery
For `connectionType: USB`, the system SHALL not request `host` or `port` and
SHALL allow association with a printer queue discovered by the Peripheral
Agent.

#### Scenario: Discover USB printer queue
- **WHEN** an administrator requests device discovery on a supported agent host
- **THEN** the agent SHALL return discoverable USB printer descriptors with stable agent-generated IDs

#### Scenario: Reject unknown USB association
- **WHEN** a USB printer is registered with a `deviceId` not currently discovered by the agent
- **THEN** the agent SHALL return a controlled device-not-found error

### Requirement: Thermal 80 mm profile
The Xprinter XP-80T SHALL support the `THERMAL_80MM` profile for USB and
NETWORK registration and printing.

#### Scenario: Register XP-80T profile
- **WHEN** an administrator registers an XP-80T printer through either supported connection
- **THEN** the system SHALL accept `profileId: THERMAL_80MM`

### Requirement: Transport-independent printing
The POS/browser layer SHALL invoke a printer document endpoint using device and
terminal identity without constructing ESC/POS bytes or branching on USB versus
NETWORK.

#### Scenario: Print through selected transport
- **WHEN** a test print is requested for a configured printer
- **THEN** the agent SHALL resolve the adapter from its connection type and execute the matching transport

### Requirement: Test print
An administrator SHALL be able to execute a minimum test print that identifies
MANUS POS, XP-80T, `THERMAL_80MM`, connection and terminal.

#### Scenario: Successful USB test print
- **WHEN** a registered USB printer queue is available and a test print is requested
- **THEN** the agent SHALL submit the test document through the queue and report the completed job

#### Scenario: Successful NETWORK test print
- **WHEN** a registered NETWORK printer accepts its TCP connection and a test print is requested
- **THEN** the agent SHALL send its ESC/POS document and report the completed job

### Requirement: Connection errors
The system SHALL expose distinguishable errors for missing agent configuration,
unavailable agent, device not found, timeout, rejected connection and print
failure.

#### Scenario: Agent unavailable
- **WHEN** the web application cannot reach its configured agent
- **THEN** it SHALL display an agent-unavailable error distinct from a printer error

#### Scenario: Network timeout
- **WHEN** a NETWORK printer does not respond before its configured timeout
- **THEN** the agent SHALL fail the job with a timeout-specific controlled error

#### Scenario: USB queue unavailable
- **WHEN** a registered USB queue no longer exists when printing
- **THEN** the agent SHALL fail the job with a device-not-found error and emit a printer failure event
