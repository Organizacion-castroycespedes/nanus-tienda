## Purpose

Provide privacy-safe evidence for Windows PnP printer discovery failures so operators can distinguish execution, timeout, parsing, filtering, and reconciliation problems without changing printer selection behavior.

## ADDED Requirements

### Requirement: PnP discovery SHALL expose sanitized stage outcomes

The Agent SHALL record structured diagnostics for PnP command invocation, completion, elapsed time, timeout state, sanitized error category, raw record count, parsed record count, Class_07 match count, and reconciliation input counts.

#### Scenario: Successful Class_07 discovery
- **WHEN** the PnP command completes and valid Class_07 records are parsed
- **THEN** diagnostics record completion, bounded duration, raw and parsed counts, and the number of accepted Class_07 records without recording identifiers or raw output

#### Scenario: PnP execution failure
- **WHEN** the command cannot execute, is denied, or exits unsuccessfully
- **THEN** diagnostics record an execution or permission reason code and unknown PnP availability, rather than a successful empty inventory

#### Scenario: PnP timeout
- **WHEN** the command exceeds its supported timeout
- **THEN** diagnostics record timeout explicitly and the discovery result does not claim that zero physical printers were observed

### Requirement: PnP parsing and filtering SHALL be distinguishable

The Agent SHALL distinguish empty command output, malformed output, records missing required fields, records rejected by the Class_07 predicate, and accepted records using counts and safe reason codes.

#### Scenario: Empty or malformed output
- **WHEN** the command returns no records or invalid JSON
- **THEN** diagnostics identify the corresponding empty or parse-failure category without exposing command output

#### Scenario: Record rejected by required identity fields
- **WHEN** a parsed record lacks required safe fields
- **THEN** diagnostics count it as incomplete and exclude it from physical discovery

#### Scenario: Record filtered by Class_07
- **WHEN** a parsed record is present but does not satisfy the printer compatibility predicate
- **THEN** diagnostics count it as filtered and do not classify it as a physical printer

### Requirement: Discovery API failures SHALL remain observable and compatible

The discovery endpoint SHALL preserve its existing request and response contract, while recording a sanitized outcome when orchestration or response serialization fails; it SHALL not convert an incomplete discovery response into a successful physical-printer result.

#### Scenario: Discovery orchestration completes
- **WHEN** USB and serial discovery complete with a valid response
- **THEN** the existing response shape and reconciliation behavior remain unchanged

#### Scenario: Discovery response fails after stage execution
- **WHEN** a null or incomplete value causes response construction or serialization to fail
- **THEN** the failure is classified at the API boundary and the Agent does not report a false successful physical discovery

### Requirement: Diagnostics SHALL not expose sensitive or identifying data

PnP diagnostics SHALL omit raw command output, USB instance identifiers, serial numbers, complete CompatibleID values, personal filesystem paths, credentials, and configuration payloads.

#### Scenario: Sanitized diagnostic emission
- **WHEN** any PnP discovery stage emits a diagnostic event
- **THEN** the event contains only safe stage names, counts, durations, timeout state, and bounded reason codes

### Requirement: Matched queue port metadata SHALL be preserved without changing print selection

When physical and Windows queue records are matched by existing exact identity or explicit binding rules, the Agent SHALL preserve the matched queue `portName` in the reconciled descriptor when supplied. `windowsQueueName` remains the print transport authority. The Agent SHALL NOT infer a port from PnP location data.

#### Scenario: Matched physical and queue records expose the queue port
- **WHEN** a physical printer is safely matched to a ready Windows queue with `portName`
- **THEN** the reconciled descriptor includes that queue port and remains `CONNECTED`

#### Scenario: Missing or unmatched port metadata remains safe
- **WHEN** a queue lacks port metadata or a physical record has no safe queue match
- **THEN** `portName` remains absent or empty, devices do not cross-associate, and print availability keeps using the existing status and queue checks
