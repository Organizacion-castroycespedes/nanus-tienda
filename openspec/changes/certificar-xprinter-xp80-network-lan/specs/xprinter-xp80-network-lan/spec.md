## ADDED Requirements

### Requirement: XP-80 LAN transport
The system SHALL support the existing XP-80 printer over LAN/TCP RAW using the
same canonical ESC/POS renderer as USB RAW.

#### Scenario: Network print
- **WHEN** a printer is configured with `type = PRINTER`
- **AND** `profileId = THERMAL_80MM`
- **AND** `transport = NETWORK`
- **AND** the config provides `host`, `port` and `timeoutMs`
- **THEN** the system SHALL send the same ESC/POS bytes through TCP RAW

### Requirement: Dual transport
The same physical printer SHALL be representable as `USB` or `NETWORK`
without creating separate printer models.

#### Scenario: One printer, two transports
- **WHEN** the same XP-80 is configured over USB or LAN
- **THEN** the system SHALL keep one printer model and vary only the transport

### Requirement: Configurable network behavior
The network printer SHALL support configurable host, port, timeout and test
operations.

#### Scenario: Test connection and test print
- **WHEN** the user tests the network printer
- **THEN** the system SHALL perform a controlled connection test or test print

### Requirement: Network error handling
The network printer SHALL distinguish host invalid, timeout, connection
refused, network unreachable, printer offline, socket closed and agent
offline.

#### Scenario: No fake success
- **WHEN** the socket cannot connect or write
- **THEN** the system SHALL return a controlled failure and SHALL NOT report
success

### Requirement: No regression
The network flow SHALL not break the certified XP-80 USB RAW path, physical
cut, TERM-001 canonical resolution or the portable Windows x64 agent.

#### Scenario: USB regression guard
- **WHEN** the network printer work is reviewed
- **THEN** the existing USB RAW certification evidence SHALL remain valid
