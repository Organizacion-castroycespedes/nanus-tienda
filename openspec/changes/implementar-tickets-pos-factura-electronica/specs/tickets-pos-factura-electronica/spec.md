# Requisitos

## ADDED Requirements

### Requirement: Accepted electronic invoice thermal representation

The system SHALL maintain separate POS sale and electronic invoice printable documents.

#### Scenario: Accepted document is printed

- **GIVEN** an electronic document has status `ACCEPTED` and representation data
- **WHEN** the operator requests thermal printing
- **THEN** the existing Peripheral Agent receives an `ELECTRONIC_INVOICE` payload

- The invoice SHALL print only with state `ACCEPTED` and representation available.
- CUFE, number and dates SHALL come from persisted data; fabricated values are forbidden.
- Customer fiscal fields SHALL come from the immutable `metadata.electronicBilling.customer` snapshot when present.
- Tax lines SHALL come from persisted `electronic_document_taxes` rows; totals SHALL NOT be reverse-engineered into tax lines.
- A QR SHALL be printed only when an authoritative persisted/provider QR payload exists. Missing QR data SHALL fail closed.

#### Scenario: Non-accepted document is blocked

- **GIVEN** an electronic document has status `PENDING`, `PROCESSING`, `REJECTED` or `CANCELLED`
- **WHEN** the operator requests invoice printing
- **THEN** the operation SHALL fail closed without provider or business mutation

### Requirement: Side-effect-free reprint

The renderer SHALL use the existing Peripheral Agent and reprint SHALL not create sales/documents/outbox events or call FactuCore/DIAN.

#### Scenario: Reprint uses existing data

- **GIVEN** a valid accepted representation
- **WHEN** it is reprinted
- **THEN** only a printer job is requested

### Requirement: Printable fiscal projection

The report read model SHALL expose only sanitized immutable customer fiscal
fields and persisted tax lines needed for representation. Current customer
master data MUST NOT replace an absent snapshot.

#### Scenario: Reprint uses persisted fiscal data

- **GIVEN** an accepted document has a customer snapshot and tax rows
- **WHEN** the operator requests its printable representation
- **THEN** the report read model returns those persisted values without using current customer master data

### Requirement: Role menu visibility

`USER`, `ADMIN` and `SUPER_USER` with POS READ SHALL see Gestión Operativa/Ventas for their tenant.

#### Scenario: POS role receives operations menu

- **GIVEN** the backend grants `OPERATIONS` and `OPERATIONS_SALES`
- **WHEN** the Web filters the server menu response
- **THEN** both entries remain visible

## Notes

- Backend `OperationalSaleScope` SHALL remain unchanged.
