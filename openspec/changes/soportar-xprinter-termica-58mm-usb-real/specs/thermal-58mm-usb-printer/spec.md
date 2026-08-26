## ADDED Requirements

### Requirement: Dedicated 58 mm thermal profile
The system SHALL expose a dedicated `THERMAL_58MM` printer profile for USB thermal printing and SHALL NOT alias it to the `THERMAL_80MM` profile.

#### Scenario: 58 mm printer is selected
- **WHEN** a USB printer is discovered or configured with the 58 mm profile
- **THEN** the returned profile is `THERMAL_58MM` with its own width and capability values

#### Scenario: 80 mm printer remains unchanged
- **WHEN** an 80 mm thermal printer is used
- **THEN** the 80 mm profile and layout remain unchanged

### Requirement: USB discovery is stable and deduplicated
The system SHALL discover USB printers with a stable descriptor containing `agentInstallationId`, `deviceId`, `nativeIdentifier`, `fingerprint`, `platform`, and `architecture`, and SHALL deduplicate printers by stable identity instead of USB order.

#### Scenario: Same printer is discovered twice
- **WHEN** discovery runs more than once for the same physical USB printer
- **THEN** the agent keeps a single printer entry for that device

#### Scenario: Configured USB printer already exists
- **WHEN** a printer was already configured before discovery runs again
- **THEN** the configured printer is preserved and not replaced by a fragile USB-order id

### Requirement: USB discovery exposes printers as PRINTER devices
The system SHALL expose discovered USB thermal printers through `POST /devices/discover` as devices with `type = PRINTER` and `connectionType = USB`.

#### Scenario: A USB thermal printer is found
- **WHEN** the Peripheral Agent discovers a compatible USB queue
- **THEN** the response includes a printer device with USB metadata and a stable identifier

### Requirement: Real test print returns transport confirmation
The system SHALL support `POST /printer/test-print` for a certified 58 mm USB printer and SHALL only report success when the adapter confirms bytes were sent.

#### Scenario: Test print succeeds on real hardware
- **WHEN** the target printer is a certified 58 mm USB printer and the transport writes bytes successfully
- **THEN** the response includes `success`, `mode = REAL`, `adapterName`, `deviceId`, `terminalId`, `connectionType = USB`, `profile`, `capabilities`, `bytesSent`, and `message`

#### Scenario: Transport fails
- **WHEN** the USB transport cannot send bytes
- **THEN** the request fails and does not report a real success

### Requirement: Real ticket print uses the 58 mm profile width
The system SHALL support `POST /printer/print-ticket` for a certified 58 mm USB printer and SHALL render the ticket with the selected 58 mm profile width.

#### Scenario: Ticket is printed on 58 mm hardware
- **WHEN** a ticket is sent to the certified 58 mm USB printer
- **THEN** the rendered layout uses the 58 mm profile width and the response reports real transport metadata

#### Scenario: 80 mm layout remains stable
- **WHEN** an 80 mm printer prints a ticket
- **THEN** the 80 mm layout remains unchanged by the 58 mm work

### Requirement: Cutter capability is explicit and non-blocking
The system SHALL expose cutter capability explicitly for the 58 mm profile and SHALL allow printing to succeed even when cutter capability is false.

#### Scenario: Printer has no physical cutter
- **WHEN** the certified 58 mm printer does not have a cutter
- **THEN** `supportsCut` and `supportsPhysicalCut` are false and `print-ticket` still succeeds without cut

#### Scenario: Printer has a certified cutter
- **WHEN** the certified 58 mm printer does support a physical cutter
- **THEN** the profile exposes cutter capability and the physical cut path may be used

### Requirement: Admin peripherals can select the 58 mm USB printer
The system SHALL let the admin peripherals screen select the discovered 58 mm USB printer and SHALL show its name, USB connection, profile, status, and test-print action.

#### Scenario: 58 mm printer appears in admin peripherals
- **WHEN** a 58 mm USB printer is discovered
- **THEN** the admin peripherals screen can select it and run a test print against it
