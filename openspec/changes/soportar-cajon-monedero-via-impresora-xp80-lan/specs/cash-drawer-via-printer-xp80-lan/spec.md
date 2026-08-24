# cash-drawer-via-printer-xp80-lan Specification

## ADDED Requirements

### Requirement: Cash drawer uses printer transport
The system SHALL treat the cash drawer as a logical peripheral attached to a printer device, not as an independent TCP device.

#### Scenario: Drawer is opened through printer
- **WHEN** the system opens the cash drawer
- **THEN** it resolves a `printerDeviceId` canonical for the terminal
- **AND** it reuses the printer connection to send the drawer pulse

#### Scenario: No duplicated network config
- **WHEN** the cash drawer is configured for a network XP-80
- **THEN** the system does not store a second `host` or `port` on the drawer if the printer already owns that connection data

### Requirement: Open drawer endpoint remains stable
The system SHALL keep `POST /cash-drawer/open` available for backward compatibility.

#### Scenario: Existing client calls endpoint
- **WHEN** a client posts to `/cash-drawer/open`
- **THEN** the request still resolves a valid cash drawer operation

#### Scenario: Canonical terminal config exists
- **WHEN** the terminal has a persisted printer assignment
- **THEN** the system uses that canonical printer instead of requiring a separate drawer transport

### Requirement: Drawer pulse is one physical pulse
The system SHALL send exactly one ESC/POS drawer pulse per successful open request.

#### Scenario: Single open request
- **WHEN** the endpoint receives one valid request
- **THEN** the transport sends one pulse and one transport write

#### Scenario: No repetitive pulse loop
- **WHEN** a request succeeds
- **THEN** the system does not emit repeated pulses as part of the normal open flow

### Requirement: No automatic retry for drawer pulse
The system SHALL not retry a drawer pulse automatically when the result is ambiguous.

#### Scenario: Transport may have sent the pulse
- **WHEN** the transport failure leaves ambiguity about whether the pulse reached the printer
- **THEN** the system does not automatically retry inside the same request

### Requirement: Drawer pulse parameters are explicit
The system SHALL represent drawer pulse configuration with explicit parameters.

#### Scenario: Thermal 80mm defaults are used
- **WHEN** the drawer is bound to a THERMAL_80MM XP-80 printer
- **THEN** the system uses safe defaults for connector/pin and pulse timing

#### Scenario: Pulse profile is reported
- **WHEN** the drawer opens successfully
- **THEN** the response or technical metadata includes the pulse profile used

### Requirement: Network printer adapter is reused
The system SHALL use `NetworkEscposPrinterAdapter` for the real XP-80 LAN drawer path.

#### Scenario: Connected network printer
- **WHEN** the configured printer is `CONNECTED` and `NETWORK`
- **THEN** the system sends the drawer pulse through the network printer adapter

#### Scenario: Network printer is not reachable
- **WHEN** the configured printer is `NOT_REACHABLE`
- **THEN** the system returns a controlled operational error and does not report success

### Requirement: Response is QA-friendly
The system SHALL return enough operational detail for hardware QA without exposing secrets.

#### Scenario: Drawer opens successfully
- **WHEN** the drawer pulse is sent successfully
- **THEN** the response includes `success`, `mode`, `adapterName`, `terminalId`, `printerDeviceId`, `connectionType`, `network.host`, `network.port`, `pulse` and `bytesSent`

#### Scenario: Failure occurs
- **WHEN** the printer cannot be resolved or the transport fails
- **THEN** the response does not claim success and reports a controlled error message

### Requirement: Supported errors are explicit
The system SHALL distinguish the main failure classes for drawer opening.

#### Scenario: Printer not found
- **WHEN** the printer device does not exist
- **THEN** the system returns `printer device not found`

#### Scenario: Unsupported capability
- **WHEN** the selected printer does not support cash drawer pulse
- **THEN** the system returns `printer does not support cash drawer pulse`

#### Scenario: Network failure
- **WHEN** the network transport fails
- **THEN** the system returns `network not reachable` or `transport failure` depending on the failure source

### Requirement: Admin UI remains minimal
The system SHALL keep the admin peripheral UI small and operational.

#### Scenario: Drawer is configured in admin
- **WHEN** the admin screen shows drawer state
- **THEN** it indicates that the drawer depends on the selected printer

#### Scenario: QA test button exists
- **WHEN** the admin screen is opened
- **THEN** a `Probar apertura` action is available for the configured printer

### Requirement: Cash drawer does not auto-open on sale in this phase
The system SHALL keep automatic cash drawer opening out of scope for sale flows in this phase.

#### Scenario: Sale is paid in cash
- **WHEN** a sale is completed with cash payment
- **THEN** the system does not auto-open the drawer unless a separate approved rule already exists

### Requirement: XP-80 LAN only for this change
The system SHALL scope this change to XP-80 LAN and not include 58 mm printers.

#### Scenario: 58 mm printer exists
- **WHEN** a 58 mm printer is configured
- **THEN** this change does not add or certify cash drawer support for it
