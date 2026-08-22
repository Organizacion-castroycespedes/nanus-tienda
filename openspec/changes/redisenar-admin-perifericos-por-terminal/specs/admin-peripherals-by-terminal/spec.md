## ADDED Requirements

### Requirement: Config terminals can open peripheral administration for the canonical terminal
The system SHALL expose an action from `/[tenant]/config/terminals` that opens `/[tenant]/admin/peripherals?terminalId=<terminals.id>` using the canonical `terminals.id` value only.

#### Scenario: Open peripherals from TERM-001
- **WHEN** a user selects `TERM-001` in `/config/terminals` and clicks `Configurar periféricos`
- **THEN** the app SHALL navigate to `/[tenant]/admin/peripherals?terminalId=<TERM-001 terminals.id>`
- **AND** the URL SHALL NOT include `posTerminalId` or `local-terminal`

### Requirement: Admin peripherals SHALL center the operational terminal
The `/[tenant]/admin/peripherals` screen SHALL resolve and display a canonical operational terminal selected from `terminals`, not from `pos_terminals` as the primary commercial identity.

#### Scenario: Select a canonical terminal
- **WHEN** the user opens `/[tenant]/admin/peripherals`
- **THEN** the screen SHALL allow selection of canonical terminals from the operational terminal catalog
- **AND** the screen SHALL show `TERM-001  Terminal 1  Sucursal Principal` style labels
- **AND** `local-terminal` SHALL appear only as technical/legacy data, never as a commercial terminal option

### Requirement: Terminal switching SHALL be explicit and URL-driven
Changing the selected terminal in `/[tenant]/admin/peripherals` SHALL update the URL query parameter, reload the resolved peripheral configuration through the official API, and clear transient state from the previous terminal.

#### Scenario: Switch from TERM-001 to TERM-002
- **WHEN** the user changes the selector from TERM-001 to TERM-002
- **THEN** the app SHALL update `terminalId` in the URL/query state
- **AND** the app SHALL reload the new terminal peripheral settings through the official API
- **AND** the app SHALL clear transient device, discovery, preview, and action state from TERM-001

### Requirement: Terminal summary SHALL separate business identity from technical identifiers
The screen SHALL show the selected terminal summary with code, name, branch, active state, and peripheral configuration status. Technical identifiers such as `posTerminalId`, `agentTerminalCode`, and other bridge identifiers SHALL remain in a technical details area.

#### Scenario: Show TERM-001 summary
- **WHEN** TERM-001 is selected
- **THEN** the summary SHALL show its code, name, branch, active/inactive state, and whether peripheral settings are configured
- **AND** `posTerminalId` and `agentTerminalCode` SHALL NOT be shown as the main identity

### Requirement: Peripheral Agent block SHALL be operational and concise
The screen SHALL include an `Agent` block that shows availability, version, local connection, and the count of detected devices, and SHALL provide `Reconectar` and `Buscar dispositivos` actions. Debug metadata MAY be hidden in an advanced section.

#### Scenario: Agent available
- **WHEN** the Agent is reachable
- **THEN** the screen SHALL show `Disponible`
- **AND** the block SHALL expose version, local connection, and number of detected devices
- **AND** the user SHALL be able to reconnect and discover devices

### Requirement: Peripherals SHALL be organized by role
The screen SHALL present separate blocks for `Impresora`, `Scanner`, `Balanza`, and `Cajon`. Only the printer block SHALL be operational in this change; the other blocks SHALL preserve existing settings and SHALL NOT add new physical adapter behavior.

#### Scenario: Show existing scanner settings without new HID behavior
- **WHEN** the screen renders scanner, scale, or drawer blocks
- **THEN** it SHALL show existing configuration if present
- **AND** it SHALL NOT add new scanner HID, scale, or drawer behavior

### Requirement: Printer administration SHALL support explicit association and testing
The printer block SHALL show the friendly device name, connection type, detectability, profile, and relevant capabilities. The user SHALL be able to associate, change, test print, and disassociate with confirmation.

#### Scenario: Associate XP-80 USB
- **WHEN** the user selects the discovered XP-80 USB device and saves the association
- **THEN** the system SHALL persist the selection through the official terminal peripheral settings API
- **AND** the screen SHALL reflect the selected printer as associated

### Requirement: Discovery SHALL not persist automatically
Discovering devices SHALL only refresh the Agent runtime inventory. It SHALL NOT change terminal peripheral settings until the user explicitly associates and saves a device.

#### Scenario: Discover XP-80 LAN alongside XP-80 USB
- **WHEN** the user runs discovery and both XP-80 USB and XP-80 LAN are detected
- **THEN** both devices SHALL be shown as selectable options
- **AND** the screen SHALL NOT replace the persisted USB association automatically

### Requirement: USB and NETWORK printers SHALL remain distinct options
The UI SHALL display XP-80 USB and XP-80 LAN as separate selectable printer options. NETWORK printers SHALL show host and port, and USB printers SHALL show the USB identity, without automatic deduplication.

#### Scenario: Show XP-80 alternatives
- **WHEN** XP-80 USB and XP-80 LAN are both available
- **THEN** the UI SHALL show them as distinct options
- **AND** the NETWORK option SHALL display `192.168.123.100:9100`

### Requirement: Agent runtime registry SHALL remain separate from persistent settings
The system SHALL treat Agent device registry state as runtime/local data and `pos_terminal_peripheral_settings` as the persistent business configuration. The UI SHALL not imply that posting to the Agent is equivalent to saving terminal configuration.

#### Scenario: Runtime discovery does not change persistence
- **WHEN** the Agent discovers a new device
- **THEN** the terminal configuration SHALL remain unchanged until the user explicitly saves a peripheral association

### Requirement: Operational error states SHALL be explicit
The screen SHALL show explicit UX for Agent offline, terminal without profile, printer not configured, configured but not detected, device available but not associated, USB disconnected, NETWORK timeout, connection refused, invalid NETWORK configuration, and failed test print. The UI SHALL not convert technical failures into visual success.

#### Scenario: XP-80 LAN timeout
- **WHEN** a NETWORK printer test print times out
- **THEN** the screen SHALL show a timeout error state
- **AND** it SHALL NOT show a successful association or successful print state

### Requirement: Mock and debug tools SHALL be relegated to technical QA
Scanner simulator, mock print, conceptual ESC/POS command preview, and WebSocket event streams SHALL be removed from the main operational flow and, if retained, SHALL be placed in a collapsed technical/QA section by default.

#### Scenario: QA tools are hidden by default
- **WHEN** an operator opens `/[tenant]/admin/peripherals`
- **THEN** mock-only controls SHALL NOT dominate the primary flow
- **AND** technical tools SHALL be collapsed by default

### Requirement: Existing permission rules SHALL remain stable
The change SHALL preserve the current access model. It SHALL NOT silently widen permissions, and any necessary adjustment SHALL be the minimum required for the authorized terminal peripheral flow to work.

#### Scenario: Authorized users retain current access
- **WHEN** a user already authorized by the current route-permission model opens the screen
- **THEN** the user SHALL keep the same functional access
- **AND** no new broad permission grant SHALL be introduced silently

### Requirement: Compatibility with existing certified hardware and fallback data SHALL remain intact
The change SHALL preserve TERM-001 canonical resolution, XP-80 USB certification, XP-80 LAN certification, localhost Agent topology, Agent portable Windows x64, explicit MOCK support, and existing scanner, balancer, and drawer settings. `TERM-001` SHALL continue to persist `printerDeviceId = usb-printer-1f0028d1fa5243c2` unless a user explicitly changes it later.

#### Scenario: TERM-001 retains USB printer
- **WHEN** the admin peripherals UX is used during development
- **THEN** it SHALL NOT automatically replace the persisted `TERM-001` USB printer association
- **AND** the USB printer deviceId SHALL remain `usb-printer-1f0028d1fa5243c2`
