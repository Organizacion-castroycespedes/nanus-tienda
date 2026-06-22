## ADDED Requirements

### Requirement: Delivery driver CRUD
The system SHALL allow authorized users to manage delivery drivers per tenant.

#### Scenario: Authorized user creates a driver
- **WHEN** an authorized user creates a delivery driver with a name
- **THEN** the system stores the driver under the user's tenant
- **AND** the driver is active by default

#### Scenario: Authorized user edits a driver
- **WHEN** an authorized user edits a driver in the same tenant
- **THEN** the system updates the allowed driver fields

#### Scenario: Authorized user deactivates a driver
- **WHEN** an authorized user deactivates a driver in the same tenant
- **THEN** the system marks the driver inactive without deleting the record

#### Scenario: Inactive drivers are not available for new assignment
- **WHEN** a driver is inactive
- **THEN** the system does not expose that driver as available for new delivery assignment

#### Scenario: Drivers are tenant-isolated
- **WHEN** a user requests or mutates a driver from another tenant
- **THEN** the system rejects the operation or behaves as not found

### Requirement: Delivery driver assignment
The system SHALL allow assigning an active driver to a delivery.

#### Scenario: Active same-tenant driver can be assigned
- **WHEN** an authorized user assigns an active driver from the same tenant to a delivery
- **THEN** the delivery records the driver's `driver_id`

#### Scenario: Inactive driver cannot be assigned
- **WHEN** an authorized user assigns an inactive driver to a delivery
- **THEN** the system rejects the assignment

#### Scenario: Cross-tenant driver cannot be assigned
- **WHEN** an authorized user assigns a driver from another tenant to a delivery
- **THEN** the system rejects the assignment

#### Scenario: Assignment does not change delivery status
- **WHEN** an authorized user assigns or clears a driver
- **THEN** the delivery status remains unchanged

#### Scenario: Assigned driver appears in delivery list and detail
- **WHEN** a delivery has an assigned driver
- **THEN** the delivery list and delivery detail show the assigned driver reference

#### Scenario: Driver assignment can be cleared
- **WHEN** an authorized user assigns `driver_id` as null
- **THEN** the delivery no longer has an assigned catalog driver

### Requirement: Driver filters
The delivery list SHALL support filtering by assigned driver.

#### Scenario: Filtering by driver shows matching deliveries
- **WHEN** an authorized user filters deliveries by `driver_id`
- **THEN** the system lists deliveries assigned to that driver

#### Scenario: Deliveries without driver can still be listed normally
- **WHEN** an authorized user lists deliveries without a `driver_id` filter
- **THEN** deliveries with and without assigned drivers can appear according to the other filters

#### Scenario: Existing filters keep working
- **WHEN** an authorized user combines existing delivery filters with `driver_id`
- **THEN** the system applies all supported filters together
