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

### Requirement: Role menu visibility

`USER`, `ADMIN` and `SUPER_USER` with POS READ SHALL see Gestión Operativa/Ventas for their tenant.

#### Scenario: POS role receives operations menu

- **GIVEN** the backend grants `OPERATIONS` and `OPERATIONS_SALES`
- **WHEN** the Web filters the server menu response
- **THEN** both entries remain visible

## Notes

- Backend `OperationalSaleScope` SHALL remain unchanged.
