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

### Requirement: Billing request mode controls only the sale trigger
The system SHALL support `AUTOMATIC` and `ON_DEMAND` billing modes through one canonical outbox pipeline.

#### Scenario: Automatic mode completes a sale
- **WHEN** a confirmed, paid sale is completed in `AUTOMATIC` mode
- **THEN** one idempotent billing outbox request is created
- **AND** the provider is not called directly by the sale operation

#### Scenario: On-demand mode completes a sale
- **WHEN** a confirmed, paid sale is completed in `ON_DEMAND` mode
- **THEN** no automatic billing request is created
- **AND** a later authorized single or batch command may enqueue the same canonical sale event

### Requirement: Manual billing requests are tenant-scoped and idempotent
Manual billing commands SHALL evaluate each sale independently and SHALL never combine multiple sales into one fiscal document.

#### Scenario: A batch contains mixed sales
- **WHEN** an authorized operator submits multiple sale IDs
- **THEN** each sale returns its own eligibility and request result
- **AND** a repeated request reuses the deterministic event identity
- **AND** no provider or transmission call occurs in the command

### Requirement: Sale billing status is a lightweight read model
The sale list SHALL expose persisted billing status through one tenant-scoped batch query without provider calls per sale.

#### Scenario: Billing status is listed
- **WHEN** the POS sale report is loaded
- **THEN** statuses such as `NO_DOCUMENT`, `REQUESTED`, `PENDING`, `PROCESSING`, `ACCEPTED`, and `REJECTED` are mapped for each sale
- **AND** accepted fiscal number, CUFE, and acceptance timestamp are included only when persisted
