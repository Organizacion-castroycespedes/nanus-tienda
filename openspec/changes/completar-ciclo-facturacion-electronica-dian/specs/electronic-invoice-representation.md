# Electronic invoice representation

## Requirements

### Requirement: Accepted electronic invoices have a distinct representation
The system SHALL represent an accepted electronic invoice separately from an operational sale receipt.

#### Scenario: Accepted document is rendered
- **WHEN** a persisted electronic document has status `ACCEPTED`
- **THEN** the representation identifies an electronic invoice, uses its canonical fiscal number, and includes CUFE when available
- **AND** the representation includes persisted issuer, customer, sale, payment, tax, and total data

### Requirement: Non-accepted documents cannot claim acceptance
The system SHALL reject construction of an accepted electronic invoice representation for `PENDING`, `PROCESSING`, `REJECTED`, `TECHNICAL_ERROR`, or `CANCELLED` documents.

#### Scenario: Non-accepted document is requested
- **WHEN** a document does not have status `ACCEPTED`
- **THEN** the system returns a business validation error
- **AND** it does not call a provider or change document state

### Requirement: Fiscal metadata is not fabricated
The representation SHALL use only persisted fiscal metadata available from the provider contract.

#### Scenario: Optional provider metadata is absent
- **WHEN** QR or validation timestamp are unavailable in the current contract
- **THEN** the representation omits those fields
- **AND** it does not derive or fabricate replacement values

### Requirement: Reprinting is provider-independent
An accepted representation SHALL be renderable from persisted Manus data without provider retransmission.

#### Scenario: Representation is rendered again
- **WHEN** an accepted representation is rendered more than once
- **THEN** no provider create, transmission, or status polling is performed
- **AND** fiscal metadata remains unchanged
