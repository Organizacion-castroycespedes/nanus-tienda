## ADDED Requirements

### Requirement: Proven Windows USB queue correlation
Automatic Windows OS correlation SHALL require a unique present and healthy USBPRINT node, its exact reciprocal USB parent/child relationship, equal nonempty ContainerIds and exact supported USB port identity. It SHALL reject missing, duplicate, offline or contradictory observations and SHALL NOT use friendly-name similarity as proof. Existing explicit bindings remain separate from automatic OS proof.

#### Scenario: Bounded relevant PnP acquisition
- **WHEN** Windows printer discovery enumerates present PnP devices
- **THEN** it SHALL filter to USB devices with Class_07 compatible IDs and USBPRINT nodes before acquiring Parent, Children and ContainerId properties
- **AND** unrelated USB devices SHALL NOT receive those property queries; the existing bounded timeout, timeout diagnostics and fail-closed correlation SHALL remain unchanged

#### Scenario: Exact Windows relationship
- **WHEN** one ready queue uses the exact terminal USB port encoded by one healthy USBPRINT node whose healthy USB parent has matching VID/PID hardware identity and reciprocal children and ContainerId
- **THEN** reconciliation SHALL expose one operational discovered printer using the queue descriptor identity and SHALL preserve an existing persisted queue device ID, profile and drawer association

#### Scenario: Missing or ambiguous relationship
- **WHEN** hardware, USBPRINT, parent, container or port proof is missing, stale, mismatched or nonunique
- **THEN** discovery SHALL leave queue-only devices nonoperational and SHALL NOT force CONNECTED or adopt another printer's identity

#### Scenario: Independent printers and unplug
- **WHEN** multiple identical printers have different proven ports, or one printer is unplugged
- **THEN** only individually proven mappings SHALL become operational and persisted IDs SHALL remain stable across refresh without changing unrelated printers

### Requirement: Safe USB print and drawer diagnostics
USB print and drawer failures SHALL expose explicit allowlisted codes and safe messages through HTTP, Electron and web clients. Diagnostics SHALL exclude exception text, stderr, arguments, payloads, paths and credentials. Existing statuses and successful responses SHALL remain compatible. Classification SHALL use typed failures or controlled process exit codes, never guessed Windows message text.

#### Scenario: Command or spooler failure
- **WHEN** a mocked command reports launch failure, timeout, controlled invalid queue or spooler rejection, nonzero exit, or an unknown failure
- **THEN** the Agent SHALL return the corresponding safe category or a generic safe failure without forwarding the underlying exception

#### Scenario: Drawer certification and transport
- **WHEN** a USB drawer lacks independent certification or its RAW transport fails
- **THEN** the Agent SHALL retain certification enforcement and RAW behavior, return a safe code, and log only bounded operation, device, queue, configured transport and error-category metadata

#### Scenario: Unknown renderer error code
- **WHEN** a client receives an unrecognized code with sensitive response text
- **THEN** it SHALL use a generic safe error and SHALL NOT display that response text

#### Scenario: Mock-only validation
- **WHEN** automated diagnostic tests run
- **THEN** command runners and printers SHALL be injected fakes and no physical printer, drawer, pairing or scale command SHALL run

#### Scenario: Reserved Windows exit codes stay scoped
- **WHEN** an Agent-owned Windows USB RAW or GDI script exits with status 41 or 42
- **THEN** diagnostics SHALL identify invalid queue or spooler submission failure respectively
- **AND** the same statuses from Unix `lp` or an unspecified command source SHALL remain generic process failures without implying a Windows failure

#### Scenario: Metadata reflects the device connection
- **WHEN** a USB, NETWORK or other supported device operation fails
- **THEN** diagnostics SHALL record its connection type and transport category, apply RAW/GDI configuration only to USB, and include bounded queue identity only for USB
- **AND** USB drawer metadata SHALL retain RAW transport even when USB text printing is configured as GDI

### Requirement: Thermal 80 mm safe renderer
The Peripheral Agent SHALL render `THERMAL_80MM` documents within a safe
monospaced width of 48 columns representing no more than 68 mm of content.
It SHALL wrap long names and identifiers and keep monetary values complete and
right-aligned within that width.

#### Scenario: Long item and monetary value
- **WHEN** a ticket contains a long item name and a long monetary amount
- **THEN** the renderer SHALL wrap the item and preserve the complete amount
  without producing a line wider than the configured safe width

### Requirement: Shared RAW ESC/POS document
The USB RAW and NETWORK RAW adapters SHALL consume the same agent-owned
ESC/POS byte document for a printer profile.

#### Scenario: Thermal ticket sent through either RAW adapter
- **WHEN** a `THERMAL_80MM` ticket is printed using USB RAW or NETWORK RAW
- **THEN** the adapter SHALL transport the renderer bytes and SHALL NOT use
  browser, PDF or GDI layout calculations

### Requirement: Windows USB RAW spooler printing
When USB RAW is configured on Windows, the Peripheral Agent SHALL submit the
ESC/POS bytes to the discovered OS queue using the Windows print spooler RAW
path.

#### Scenario: Successful USB RAW print
- **WHEN** the discovered USB queue accepts a RAW job
- **THEN** the Agent SHALL return a successful printer job with the USB RAW
  adapter name and number of bytes sent

#### Scenario: USB RAW spooler failure
- **WHEN** the Windows spooler rejects, cannot open or cannot write to the
  discovered queue
- **THEN** the Agent SHALL return a controlled print error and emit a printer
  failure event

### Requirement: Explicit USB fallback
The Agent SHALL use GDI USB printing only when that transport is explicitly
configured. It SHALL NOT silently fall back from a failed USB RAW print.

#### Scenario: RAW transport unavailable
- **WHEN** USB RAW is configured but cannot be used
- **THEN** the Agent SHALL report a controlled USB RAW failure instead of
  submitting a GDI job

### Requirement: Physical cut capability truthfulness
The Agent SHALL include the ESC/POS cut command only for a RAW adapter and a
profile that supports cutting. It SHALL report `supportsPhysicalCut` false for
GDI fallback and, in the current USB implementation, all USB RAW queues.
The legacy global certification variable SHALL NOT enable USB physical-cut
capability reporting. Physical QA evidence SHALL remain separate from command
transmission and SHALL NOT imply universal device certification or drawer
pulse authorization.

#### Scenario: RAW profile supports cut
- **WHEN** a `THERMAL_80MM` ticket is rendered for USB RAW
- **THEN** the rendered byte stream SHALL contain feed followed by the ESC/POS
  cut command while the current USB response capability SHALL remain false,
  even when an operator has separately observed physical cutting

#### Scenario: GDI fallback
- **WHEN** USB GDI transport is explicitly configured
- **THEN** the response SHALL report `supportsPhysicalCut` false and SHALL NOT
  claim that a physical cut occurred

### Requirement: Final feed before physical cut
For a RAW thermal ticket with cutting enabled, the Agent SHALL serialize the
footer before an explicit final paper advance and SHALL emit the ESC/POS cut
command only after that advance.

#### Scenario: Footer remains on main ticket
- **WHEN** a ticket includes the default or supplied footer and USB RAW cutting
  is enabled
- **THEN** the byte stream SHALL order body, footer, final feed and cut, with
  the cut command as the final functional command
