## ADDED Requirements

### Requirement: Separate preview and print

Reporteria POS SHALL expose `Ver ticket` and `Imprimir` as independent actions.

#### Scenario: Open preview

- **WHEN** an operator selects `Ver ticket`
- **THEN** the system SHALL open only the ticket PDF preview

#### Scenario: Direct print

- **WHEN** an operator selects `Imprimir`
- **THEN** the system SHALL request direct printing through the Peripheral Agent without opening PDF preview or browser print dialog

### Requirement: Preview without print action

The ticket preview modal SHALL allow close and download and SHALL NOT include an
`Imprimir` action.

#### Scenario: Inspect preview footer

- **WHEN** the PDF preview modal is visible
- **THEN** its footer SHALL contain close and download controls only

### Requirement: Direct printer action

The direct print action SHALL use the configured printer for the operator's
current POS terminal and SHALL report send success or controlled failure.

#### Scenario: Send ticket to USB queue

- **WHEN** the current terminal has a configured USB `THERMAL_80MM` printer available through the Agent
- **THEN** the system SHALL submit the ticket to that queue and show `Ticket enviado a la impresora`

#### Scenario: Reporteria has no in-memory terminal context

- **WHEN** the operator opens Reporteria without a `terminalId` in browser POS state
- **THEN** the system SHALL resolve the configured default terminal for the current branch before calling the Agent

### Requirement: Real terminal printer configuration

A direct print request for a real terminal SHALL NOT silently use
`mock-printer-001` when no real printer configuration is available.

#### Scenario: Real terminal missing printer

- **WHEN** a current terminal in REAL or HYBRID mode has no non-mock printer device
- **THEN** the system SHALL return a distinguishable `PRINTER_NOT_CONFIGURED` error without calling the Agent

### Requirement: Canonical immutable sale data

Direct ticket printing SHALL use authorized canonical sale data and SHALL NOT
change sale, payment, inventory, tax, discount or fiscal state.

#### Scenario: Printer failure

- **WHEN** direct printing fails
- **THEN** the sale dataset and its business state SHALL remain unchanged

### Requirement: Controlled direct-print errors

The system SHALL distinguish Agent offline, printer not configured, device not
found, timeout and print queue failure.

#### Scenario: USB queue disconnected

- **WHEN** the configured USB queue is absent
- **THEN** the Agent SHALL fail the job with device-not-found and the UI SHALL show controlled feedback

### Requirement: USB physical cut capability

The system SHALL NOT claim physical cut support for USB system-queue printing
unless it sends verified RAW ESC/POS cut bytes.

#### Scenario: USB queue capability response

- **WHEN** the Agent prints through `System.Drawing.Printing.PrintDocument`
- **THEN** its capability response SHALL report physical cut as unsupported
