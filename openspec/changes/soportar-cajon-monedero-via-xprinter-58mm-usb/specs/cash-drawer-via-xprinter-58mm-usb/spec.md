## ADDED Requirements

### Requirement: Drawer opens through the XP-58 USB printer transport
The system SHALL treat the cash drawer as a logical peripheral attached to a certified XP-58 USB printer and SHALL NOT model it as a separate USB device.

#### Scenario: Drawer is opened through the printer
- **WHEN** the system opens the drawer
- **THEN** it resolves the canonical `printerDeviceId` for the terminal
- **AND** it sends the drawer pulse through the XP-58 USB printer transport

#### Scenario: No duplicate drawer device
- **WHEN** the drawer is configured
- **THEN** the system does not create a second USB device for the drawer

### Requirement: Drawer support is device-scoped and certified
The system SHALL only report drawer support for a printer device that has been explicitly certified for cash drawer pulse support.

#### Scenario: XP-58 is not certified yet
- **WHEN** the printer device has not been certified for drawer pulse
- **THEN** the system does not claim drawer support for that device

#### Scenario: XP-58 is certified
- **WHEN** the printer device is certified for drawer pulse
- **THEN** the system may open the drawer through that device

### Requirement: Drawer pulse sends exactly one command
The system SHALL send exactly one ESC/POS cash drawer pulse per successful request.

#### Scenario: Single request
- **WHEN** the endpoint receives one valid drawer request
- **THEN** the transport sends one pulse and one write

#### Scenario: No automatic retry
- **WHEN** a drawer request fails ambiguously
- **THEN** the system does not retry automatically inside the same request

### Requirement: Drawer response is QA friendly
The system SHALL return transport metadata that can be used to certify the drawer hardware.

#### Scenario: Drawer opens successfully
- **WHEN** the drawer pulse reaches the printer transport
- **THEN** the response includes `success`, `mode`, `adapterName`, `terminalId`, `printerDeviceId`, `connectionType`, `profile`, `pulse`, `bytesSent`, and `message`

#### Scenario: Transport fails
- **WHEN** the printer cannot send the pulse
- **THEN** the response does not claim success

### Requirement: Drawer capability is independent from cut capability
The system SHALL keep drawer support separate from cutter support.

#### Scenario: No automatic cutter on XP-58
- **WHEN** the XP-58 has no automatic cutter
- **THEN** drawer certification is evaluated independently from `supportsCut`

#### Scenario: Manual cut still exists
- **WHEN** the printer is manually cut by a human
- **THEN** that does not change drawer capability

### Requirement: Admin peripherals can test drawer open
The system SHALL let the admin peripherals screen trigger a manual drawer test on the selected printer.

#### Scenario: Test button is available
- **WHEN** the admin peripherals screen is opened
- **THEN** it exposes a `Probar apertura` action for the configured printer
