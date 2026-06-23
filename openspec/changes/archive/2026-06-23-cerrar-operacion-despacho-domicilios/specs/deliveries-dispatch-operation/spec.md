## ADDED Requirements

### Requirement: Driver selection during delivery creation
The delivery creation flow SHALL allow assigning an active driver when creating a delivery.

#### Scenario: User selects an active driver during creation
- **WHEN** an authorized user creates a delivery and selects an active driver from the same tenant
- **THEN** the created delivery records `driver_id`

#### Scenario: Creating with no driver remains allowed
- **WHEN** an authorized user creates a delivery without selecting a driver
- **THEN** the delivery is created without `driver_id`

#### Scenario: Inactive driver cannot be selected
- **WHEN** a create request includes an inactive driver
- **THEN** the system rejects the request

#### Scenario: Assigning driver during creation does not change delivery status
- **WHEN** a delivery is created with `driver_id`
- **THEN** the delivery status remains the normal creation status
- **AND** no cash, payment, POS, fiscal, or inventory state is mutated

### Requirement: Driver assignment after creation
The delivery detail and list SHALL allow assigning or changing the delivery driver after creation.

#### Scenario: Delivery without driver exposes Assign driver
- **WHEN** a delivery has no assigned driver
- **THEN** the list/detail exposes `Asignar repartidor`

#### Scenario: Delivery with driver exposes Change driver
- **WHEN** a delivery already has an assigned driver
- **THEN** the list/detail exposes `Cambiar repartidor`

#### Scenario: Active same-tenant driver can be assigned
- **WHEN** an authorized user assigns an active driver from the same tenant
- **THEN** the delivery records that driver

#### Scenario: Inactive or cross-tenant driver is rejected
- **WHEN** an authorized user assigns an inactive driver or a driver from another tenant
- **THEN** the system rejects the assignment

#### Scenario: Assignment does not mutate protected state
- **WHEN** a driver is assigned, changed, or cleared
- **THEN** delivery status, cash, payments, POS, fiscal/electronic invoice, and inventory remain unchanged

### Requirement: Delivery ticket generation
The system SHALL generate an operational delivery ticket through the reporting backend.

#### Scenario: Ticket can be generated for a delivery with order_id
- **WHEN** a delivery has `order_id`
- **THEN** the delivery ticket includes the related order reference

#### Scenario: Ticket can be generated for a delivery with sale_id
- **WHEN** a delivery has `sale_id`
- **THEN** the delivery ticket includes the related sale reference

#### Scenario: Ticket includes operational delivery data
- **WHEN** a delivery ticket is generated
- **THEN** it includes customer, address, phone, driver when assigned, status, delivery value, totals, and notes

#### Scenario: Ticket is non-fiscal
- **WHEN** a delivery ticket is generated
- **THEN** it is identified as operational and non-fiscal
- **AND** it does not mutate delivery, sale, payment, cash, invoice, POS, or inventory state

### Requirement: Delivery ticket alongside order or sale
The delivery ticket SHALL be usable alongside existing order or sale tickets without replacing them.

#### Scenario: Delivery detail exposes Ticket domicilio
- **WHEN** an authorized user views a delivery
- **THEN** the user can open the delivery ticket

#### Scenario: Ticket references related order when present
- **WHEN** the delivery has an order
- **THEN** the delivery ticket shows the order reference

#### Scenario: Ticket references related sale when present
- **WHEN** the delivery has a sale
- **THEN** the delivery ticket shows the sale reference

#### Scenario: Existing order and sale ticket flows remain unchanged
- **WHEN** delivery ticket support is added
- **THEN** existing order and sale ticket routes and PDF behavior remain unchanged
