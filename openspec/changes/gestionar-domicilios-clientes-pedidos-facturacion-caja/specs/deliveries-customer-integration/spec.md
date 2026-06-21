## ADDED Requirements

### Requirement: Delivery customer link
The system SHALL define how deliveries conceptually link to customers while preserving the delivery address and contact data used at the time of dispatch.

#### Scenario: Existing customer is used
- **WHEN** a delivery is associated with an existing customer
- **THEN** the delivery shows customer name, document when available, phone and delivery address snapshot

#### Scenario: Customer data changes after delivery creation
- **WHEN** an associated customer is updated after a delivery is created
- **THEN** the delivery keeps its original address/contact snapshot for historical traceability

### Requirement: Customer addresses for deliveries
The system SHALL allow a delivery to use a punctual address typed in the delivery or source document without requiring customer address model changes in this phase.

#### Scenario: Customer has no registered address
- **WHEN** a delivery is created for a customer without a stored address
- **THEN** the delivery creation flow requires a delivery address and contact phone

#### Scenario: Customer has multiple future addresses
- **WHEN** future customer address book support exists
- **THEN** the delivery can reference the selected address while still storing the address snapshot used for that delivery

### Requirement: Generic customer delivery
The system SHALL allow delivery design for generic customer or final consumer flows only when enough delivery contact data is captured.

#### Scenario: Generic customer is used
- **WHEN** the source sale or order uses a generic customer
- **THEN** the delivery requires contact name or reference, phone, delivery address and observation sufficient to execute the delivery

#### Scenario: Missing contact data blocks delivery readiness
- **WHEN** a generic customer delivery has no phone or delivery address
- **THEN** the delivery cannot be considered ready for dispatch

### Requirement: No customer implementation in this phase
The system SHALL NOT require changes to customer tables, APIs, forms or permission behavior during this OpenSpec-only phase.

#### Scenario: Customer integration is reviewed
- **WHEN** this change is validated
- **THEN** customer behavior remains documentation-only and no productive customer code or SQL is modified

### Requirement: Customer delivery address model remains optional
The system SHALL document `customer_delivery_addresses` as a future optional address-book table while keeping delivery address snapshot mandatory.

#### Scenario: Address book is deferred
- **WHEN** v0.0.1 technical scope is reviewed
- **THEN** the delivery module can proceed conceptually with `deliveries` address snapshot and without requiring a customer address-book migration

#### Scenario: Address book is later enabled
- **WHEN** a future phase adds `customer_delivery_addresses`
- **THEN** each selected address still copies contact and address data into the delivery snapshot for traceability

### Requirement: Customer tenant consistency
The system SHALL require future delivery customer links to stay within the same tenant.

#### Scenario: Customer belongs to same tenant
- **WHEN** a future delivery references `customer_id`
- **THEN** the referenced customer must belong to the same `tenant_id` as the delivery

#### Scenario: Cross-tenant customer link is attempted
- **WHEN** a future request links a delivery to a customer from another tenant
- **THEN** the backend must reject the operation
