## ADDED Requirements

### Requirement: REAL inventory excludes mocks
The Agent SHALL exclude `mock-*` identifiers and `MOCK` connections in REAL mode.

#### Scenario: REAL list
- **WHEN** a client lists devices in REAL mode
- **THEN** no mock device SHALL be returned

### Requirement: Physical and configured state are distinct
The system SHALL distinguish physical discovery, persisted configuration and terminal assignment.

#### Scenario: Queue without hardware
- **WHEN** a print queue exists but PnP hardware is absent
- **THEN** the device SHALL be `OFFLINE` or `NOT_DETECTED`, never `CONNECTED`

### Requirement: Safe printer reconciliation
The system SHALL merge PnP and queue records only with exact native identity.

#### Scenario: Ambiguous identities
- **WHEN** two records lack a strong shared identity
- **THEN** both records SHALL remain visible

### Requirement: Terminal-scoped configuration
The system SHALL persist logical peripheral configuration and assignment within tenant, branch and terminal scope.

#### Scenario: Change active printer
- **WHEN** printer B replaces printer A as default
- **THEN** B becomes active and A configuration remains persisted

### Requirement: Optional hardware
The system SHALL allow continuation with zero physical peripherals.

#### Scenario: Empty inventory
- **WHEN** discovery returns no devices
- **THEN** the user SHALL continue without fabricated devices
