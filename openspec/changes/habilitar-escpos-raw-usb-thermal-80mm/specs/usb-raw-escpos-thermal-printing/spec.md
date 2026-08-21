## ADDED Requirements

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
GDI fallback and unverified USB RAW queues. It SHALL report it true only after
explicit physical-cut certification, while requiring physical QA before
claiming hardware cut success.

#### Scenario: RAW profile supports cut
- **WHEN** a `THERMAL_80MM` ticket is rendered for USB RAW
- **THEN** the rendered byte stream SHALL contain feed followed by the ESC/POS
  cut command and, after explicit physical-cut certification, the response
  capability SHALL report physical-cut support

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
