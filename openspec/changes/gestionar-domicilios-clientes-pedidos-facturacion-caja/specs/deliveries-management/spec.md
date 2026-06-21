## ADDED Requirements

### Requirement: Delivery records define the operational delivery contract
The system SHALL define a future Domicilios module that can register and consult delivery records associated with a tenant and, when applicable, a branch, customer, order, sale, invoice, responsible user, shipping value, payment method, cash session, timestamps and observations.

#### Scenario: Manual delivery has minimum data
- **WHEN** a delivery is created manually in the future Domicilios module
- **THEN** the delivery requires tenant scope, delivery address, neighborhood or zone/reference when known, contact phone, initial status, creating user, creation timestamp and observations when needed

#### Scenario: Delivery references a source document
- **WHEN** a delivery is created from an order, sale or invoice
- **THEN** the delivery stores the source type and source identifier without mutating the source document in this OpenSpec phase

#### Scenario: Delivery keeps address snapshot
- **WHEN** customer or order data changes after the delivery is registered
- **THEN** the delivery keeps the address and contact snapshot used for the delivery trace

### Requirement: Delivery state model
The system SHALL define the v0.0.1 delivery states as `PENDIENTE`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `CANCELADO` and `NO_ENTREGADO`.

#### Scenario: Initial delivery state
- **WHEN** a delivery is registered and no dispatch action has occurred
- **THEN** the delivery starts as `PENDIENTE` unless the creating flow explicitly dispatches it

#### Scenario: No additional operational state is required in v0.0.1
- **WHEN** assignment, payment, collection or retry information is needed
- **THEN** the system records that information as fields or events instead of adding extra states in v0.0.1

### Requirement: Delivery state transitions
The system SHALL allow only documented delivery state transitions and SHALL record traceability for every transition.

#### Scenario: Pending delivery advances or cancels
- **WHEN** a delivery is in `PENDIENTE`
- **THEN** it can transition only to `EN_PREPARACION`, `DESPACHADO` or `CANCELADO`

#### Scenario: Preparation delivery advances or cancels
- **WHEN** a delivery is in `EN_PREPARACION`
- **THEN** it can transition only to `DESPACHADO` or `CANCELADO`

#### Scenario: Dispatched delivery closes
- **WHEN** a delivery is in `DESPACHADO`
- **THEN** it can transition only to `ENTREGADO` or `NO_ENTREGADO`

#### Scenario: Final states stay closed
- **WHEN** a delivery is in `ENTREGADO`, `CANCELADO` or `NO_ENTREGADO`
- **THEN** the state cannot change in v0.0.1 and any retry requires a future explicit design

#### Scenario: Transition trace is captured
- **WHEN** a delivery changes state
- **THEN** the transition records actor, previous state, new state, timestamp and reason or observation when applicable

### Requirement: Delivery list and detail UX
The system SHALL define a future Domicilios UI with a list, filters, detail view, actions by state, creation flow, empty states and responsive behavior consistent with Manus POS.

#### Scenario: Delivery list filters records
- **WHEN** an authorized user opens the future delivery list
- **THEN** the UI offers filters for status, customer, date, order or invoice, responsible user and cash session when applicable

#### Scenario: Detail shows operational trace
- **WHEN** an authorized user opens a delivery detail
- **THEN** the UI shows customer summary, delivery address, source document, status, responsible user, payment/shipping information, timestamps, observations and transition history when available

#### Scenario: Actions respect state
- **WHEN** a delivery is shown in the list or detail view
- **THEN** only actions allowed for the current state and permissions are enabled

#### Scenario: Responsive view avoids horizontal overflow
- **WHEN** the delivery UI is used on mobile or narrow screens
- **THEN** tables, filters and action controls adapt without horizontal overflow

### Requirement: Tenant isolation for deliveries
The system SHALL require every delivery to belong to a tenant and SHALL prevent delivery data from being exposed across tenants.

#### Scenario: Tenant-scoped actor views deliveries
- **WHEN** an authenticated actor without global scope lists deliveries
- **THEN** the results include only deliveries from the authenticated tenant and authorized branch scope

#### Scenario: Cross-tenant delivery access is attempted
- **WHEN** an actor requests a delivery from another tenant
- **THEN** the system rejects access according to the authorization model

### Requirement: Web and Electron considerations remain non-implementation guidance
The system SHALL document Web/Electron delivery risks without implementing offline behavior in this phase.

#### Scenario: Web-only client operates deliveries
- **WHEN** a Type A Web 100 percent client uses deliveries in a future phase
- **THEN** the design assumes online operation and server-authoritative state

#### Scenario: Electron client has limited connectivity
- **WHEN** a Type B Electron 100 percent client needs delivery operation with limited connectivity
- **THEN** offline state changes, cash collection and invoice synchronization require a separate design before implementation

#### Scenario: Hybrid client uses Web and Electron
- **WHEN** a Type D client combines Web and Electron
- **THEN** the design flags conflict resolution, duplicate dispatch and cash reconciliation as future risks
