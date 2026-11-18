# Spec Delta

## Purpose

Defines independent controls for real adapter use and automatic peripheral discovery so QA can stay idle at startup while deliberate device operations retain their existing trust and authorization contracts.

## ADDED Requirements

### Requirement: Real adapter availability is independent from automatic discovery

The Agent SHALL use `enableRealAdapters` to control physical adapter operations and a separate boolean `discoverOnStartup` to control startup discovery. Startup discovery SHALL run only when both values are exactly `true`.

#### Scenario: QA enables adapters without startup discovery
- **WHEN** configuration sets `enableRealAdapters` to `true` and `discoverOnStartup` to `false`
- **THEN** the Agent SHALL retain real adapter capability and SHALL NOT discover devices during startup

#### Scenario: Startup discovery is explicitly enabled
- **WHEN** configuration sets both `enableRealAdapters` and `discoverOnStartup` to `true`
- **THEN** the Agent MAY perform its existing startup discovery

#### Scenario: Startup discovery cannot override disabled adapters
- **WHEN** configuration sets `enableRealAdapters` to `false` and `discoverOnStartup` to `true`
- **THEN** startup discovery SHALL remain disabled

### Requirement: Missing or invalid startup discovery configuration fails closed

The Agent and packaged installer UI SHALL interpret missing, malformed, non-boolean, or unreadable `discoverOnStartup` configuration as disabled. Explicit environment variables SHALL take precedence over local JSON values for verified dev and production profiles. The verified QA package profile SHALL force startup discovery off even when an inherited environment variable or stale JSON value says `true`.

#### Scenario: Legacy config omits the new field
- **WHEN** a valid Agent config has no `discoverOnStartup` field
- **THEN** Agent and installer startup discovery SHALL be disabled

#### Scenario: Invalid config value
- **WHEN** `discoverOnStartup` is not a JSON boolean or the packaged config cannot be read
- **THEN** automatic discovery SHALL be disabled without changing adapter availability

#### Scenario: Environment override disables discovery
- **WHEN** the local config enables startup discovery but `PERIPHERALS_DISCOVER_ON_STARTUP` is set to `false`
- **THEN** the Agent SHALL keep startup discovery disabled

#### Scenario: QA locks startup discovery off
- **WHEN** the packaged Agent profile is `qa` and the inherited `PERIPHERALS_DISCOVER_ON_STARTUP` value is `true`
- **THEN** the Agent and installer UI SHALL keep automatic startup discovery disabled

### Requirement: Environment packages declare their discovery policy

Each Windows package profile SHALL write its verified package profile and explicit adapter and startup discovery booleans. QA SHALL package `enableRealAdapters=true` and `discoverOnStartup=false`; dev and production SHALL preserve their current real adapter profile and set startup discovery explicitly to preserve their current behavior. Missing or unverified profile SHALL fail closed for automatic discovery.

#### Scenario: QA profile
- **WHEN** the Windows package is built with the QA environment
- **THEN** packaged configuration SHALL retain the QA endpoint and audience, set `enableRealAdapters` to `true`, and set `discoverOnStartup` to `false`

#### Scenario: Missing or unverified package profile
- **WHEN** the Agent config has no recognized package profile or the config cannot be read
- **THEN** the Agent SHALL keep startup discovery disabled, regardless of inherited environment values

#### Scenario: Production profile compatibility
- **WHEN** the Windows package is built with the production environment
- **THEN** packaged configuration SHALL set `enableRealAdapters` and `discoverOnStartup` to `true`

### Requirement: Manual discovery requires an explicit user action

With automatic discovery disabled, the system SHALL perform physical inventory only after an explicit manual discovery request. A discovery result SHALL remain a candidate list and SHALL NOT by itself configure, assign, pair, authorize, or operate a device.

#### Scenario: Operator requests manual discovery
- **WHEN** an operator activates the existing manual discovery control
- **THEN** the Agent MAY return candidates from the existing supported discovery providers and SHALL leave device selection and configuration explicit

#### Scenario: Startup without a manual request
- **WHEN** Agent health or the installer UI starts with `discoverOnStartup` disabled and no manual discovery action occurs
- **THEN** no physical discovery request SHALL be issued

### Requirement: Windows serial candidates merge independent inventories

The Windows serial provider SHALL query `Win32_SerialPort` and present PnP `Ports` independently, retain healthy present candidates from either successful source, and reconcile by normalized PnP identity and COM port. It SHALL exclude absent or non-OK entries and conflicting identity/port mappings. A source failure or invalid output SHALL be reported without discarding valid results from the other source; discovery SHALL fail when both sources fail.

#### Scenario: PnP-only COM port is retained beside CIM ports
- **WHEN** `Win32_SerialPort` reports healthy COM3 and COM4 entries and `Get-PnpDevice -PresentOnly` reports a healthy COM6 entry absent from CIM
- **THEN** the serial candidate inventory SHALL include all three ports and SHALL allow the existing exact VID/PID ROCHI profile matcher to classify the COM6 candidate without claiming communication or weight

#### Scenario: Duplicate, absent, unhealthy, or conflicting serial entries
- **WHEN** both sources report the same identity and COM port, or report absent/non-OK entries or conflicting mappings
- **THEN** the provider SHALL return one candidate for an exact duplicate and SHALL exclude absent, unhealthy, and ambiguous mappings

#### Scenario: One serial inventory source fails
- **WHEN** one source returns an execution or parse failure and the other source returns valid records
- **THEN** the failure SHALL be observable and the valid records SHALL remain available

#### Scenario: Both serial inventory sources fail
- **WHEN** both sources return an execution or parse failure
- **THEN** serial discovery SHALL fail with a controlled error

### Requirement: Health remains available without hardware discovery

The local Agent health endpoint SHALL remain available independently of real adapter enablement, discovery policy, device presence, or enrollment pairing state.

#### Scenario: QA health without devices
- **WHEN** the QA Agent starts with no discovery and no configured physical devices
- **THEN** local health SHALL report Agent health without enumerating hardware

### Requirement: Automated tests cannot use the native Windows discovery runner

The default Windows printer and serial enumeration runner SHALL refuse native commands under `node:test`. Tests that need discovery results SHALL inject a fake command runner or fake provider.

#### Scenario: Default Windows runner is invoked by a test
- **WHEN** a test uses the default Windows discovery provider
- **THEN** the provider SHALL reject before invoking PowerShell, Windows spooler, PnP, or serial enumeration

#### Scenario: Discovery unit test supplies a fake
- **WHEN** a test injects a fake command runner
- **THEN** the test SHALL exercise parsing and reconciliation without native process or device access

### Requirement: Existing device trust and operation gates remain in force

Changing adapter or discovery configuration SHALL NOT bypass enrollment trust, scale binding, operator KG confirmation, printer certification, or any device-specific operation guard.

#### Scenario: Pairing trust is missing
- **WHEN** enrollment public key or Key ID is missing or invalid
- **THEN** pairing SHALL remain unavailable and fail closed even if real adapters are enabled

#### Scenario: Real scale capture lacks KG authorization
- **WHEN** a physical ROCHI reading is available without an authorized binding and explicit operator KG confirmation
- **THEN** the reading SHALL NOT satisfy the commercial scale capture gate

