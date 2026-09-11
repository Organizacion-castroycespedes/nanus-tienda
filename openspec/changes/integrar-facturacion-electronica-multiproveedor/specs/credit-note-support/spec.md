## ADDED Requirements

### Requirement: Credit notes reference the original invoice
The system SHALL support credit notes that reference the original document, original provider document id when available, and the business reason for the reversal.

#### Scenario: Credit note is issued for an invoice
- **WHEN** a credit note is created against an existing invoice
- **THEN** the new document stores a reference to the original electronic document
- **AND** the credit note keeps its own lifecycle

#### Scenario: Multiple credit notes target one invoice
- **WHEN** more than one credit note is needed for the same invoice
- **THEN** each note keeps its own independent record and references the same original document

#### Scenario: Credit note is not yet transmitted
- **WHEN** a credit note exists before provider transmission
- **THEN** the document still preserves the original references and snapshot data

### Requirement: Credit note line history is preserved
The system SHALL preserve line-level credit history so that credited quantities and amounts remain auditable.

#### Scenario: Partial credit note
- **WHEN** only some invoice lines are credited
- **THEN** the document keeps the credited line snapshot and quantity

