# deliveries-management Specification

## Purpose
TBD - created by archiving change gestionar-domicilios-clientes-pedidos-facturacion-caja. Update Purpose after archive.
## Requirements
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
The system SHALL define the v0.0.1 backend delivery states as `DRAFT`, `CREATED`, `ASSIGNED`, `DISPATCHED`, `DELIVERED`, `NOT_DELIVERED` and `CANCELLED`.

#### Scenario: Initial delivery state
- **WHEN** a delivery is registered and no dispatch action has occurred
- **THEN** the delivery starts as `CREATED`

#### Scenario: No additional operational state is required in v0.0.1
- **WHEN** assignment, payment, collection or retry information is needed
- **THEN** the system records that information as fields or events instead of adding extra states in v0.0.1

### Requirement: Delivery state transitions
The system SHALL allow only documented delivery state transitions and SHALL record traceability for every transition.

#### Scenario: Pending delivery advances or cancels
- **WHEN** a delivery is in `CREATED`
- **THEN** it can transition only to `ASSIGNED` or `CANCELLED`

#### Scenario: Preparation delivery advances or cancels
- **WHEN** a delivery is in `ASSIGNED`
- **THEN** it can transition only to `DISPATCHED` or `CANCELLED`

#### Scenario: Dispatched delivery closes
- **WHEN** a delivery is in `DISPATCHED`
- **THEN** it can transition only to `DELIVERED` or `NOT_DELIVERED`

#### Scenario: Final states stay closed
- **WHEN** a delivery is in `DELIVERED`, `CANCELLED` or `NOT_DELIVERED`
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

### Requirement: Delivery technical data model
The system SHALL define and implement the approved Fase 4 base `deliveries` data model with tenant scope, branch scope, source links, delivery snapshot, state, money fields, responsible users, timestamps, metadata and notes using direct PostgreSQL SQL DDL.

#### Scenario: Delivery table fields are proposed
- **WHEN** the technical design is reviewed
- **THEN** it includes proposed fields for `id`, `tenant_id`, `branch_id`, `customer_id`, `order_id`, `sale_id`, `invoice_id`, `cash_session_id`, `delivery_number`, `status`, contact/address snapshot, delivery fee, payment data, responsible users, lifecycle timestamps, reasons and notes

#### Scenario: Candidate support tables are documented
- **WHEN** audit, payment, address book or assignment history is evaluated
- **THEN** the design documents candidate tables `delivery_status_history`, `delivery_payment_events`, `customer_delivery_addresses` and `delivery_assignments` without requiring their immediate creation

#### Scenario: Base migration is created
- **WHEN** Fase 4 base implementation is completed
- **THEN** `scripts/database/migrations/V063__deliveries_base.sql` creates `deliveries` and `delivery_status_history` with UUID primary keys, `tenant_id`, `branch_id`, `CHECK` constraints, indexes and safe foreign keys to existing UUID tables

### Requirement: Delivery technical transition fields
The system SHALL document mandatory future fields for dispatch, delivery, cancellation and not-delivered transitions.

#### Scenario: Dispatch transition fields are required
- **WHEN** a future delivery transitions to `DISPATCHED`
- **THEN** the future contract requires responsible user or assigned user, dispatch actor and dispatch timestamp

#### Scenario: Delivered transition fields are required
- **WHEN** a future delivery transitions to `DELIVERED`
- **THEN** the future contract requires delivery actor, delivery timestamp and collection information when payment on delivery applies

#### Scenario: Cancel transition fields are required
- **WHEN** a future delivery transitions to `CANCELLED`
- **THEN** the future contract requires cancellation actor, cancellation timestamp and cancellation reason

#### Scenario: Not-delivered transition fields are required
- **WHEN** a future delivery transitions to `NOT_DELIVERED`
- **THEN** the future contract requires not-delivered actor, not-delivered timestamp and not-delivered reason

### Requirement: Delivery API contract
The system SHALL implement the initial delivery CRUD API endpoints in Fase 4 and SHALL keep action and reporting endpoints deferred to later phases.

#### Scenario: Delivery CRUD endpoints are proposed
- **WHEN** the technical API contract is reviewed
- **THEN** it includes `GET /api/deliveries`, `POST /api/deliveries`, `GET /api/deliveries/:id` and `PATCH /api/deliveries/:id`

#### Scenario: Delivery list endpoint is implemented
- **WHEN** an authenticated actor calls `GET /api/deliveries`
- **THEN** the backend returns only records for the authenticated tenant and supports filters for `status`, `branch_id`, `customer_id`, `date_from`, `date_to`, `page` and `limit`

#### Scenario: Delivery list can filter by source sale
- **WHEN** an authenticated actor calls `GET /api/deliveries?sale_id=...`
- **THEN** the backend filters deliveries by the linked sales document without exposing other tenants

#### Scenario: Delivery create endpoint is implemented
- **WHEN** an authenticated actor calls `POST /api/deliveries` with delivery address, branch context and customer reference or contact data
- **THEN** the backend creates a `CREATED` delivery and writes the initial `delivery_status_history` row in the same transaction

#### Scenario: Delivery detail endpoint is implemented
- **WHEN** an authenticated actor calls `GET /api/deliveries/:id`
- **THEN** the backend returns the delivery only when the id belongs to the actor tenant

#### Scenario: Delivery detail can be resolved from a sale source
- **WHEN** the future backend needs to show delivery from a billed sales document
- **THEN** the delivery can be resolved through the linked `sale_id` without changing the delivery lifecycle

#### Scenario: Delivery update endpoint is implemented with limited editable fields
- **WHEN** an authenticated actor calls `PATCH /api/deliveries/:id`
- **THEN** the backend permits only customer snapshot, address, reference, delivery fee, subtotal, total, payment method, notes and metadata updates and does not allow status changes

#### Scenario: Delivery action endpoints are proposed
- **WHEN** delivery state actions are reviewed
- **THEN** it includes `POST /api/deliveries/:id/assign`, `POST /api/deliveries/:id/dispatch`, `POST /api/deliveries/:id/mark-delivered`, `POST /api/deliveries/:id/mark-not-delivered` and `POST /api/deliveries/:id/cancel`

#### Scenario: Delivery action endpoints are implemented
- **WHEN** Fase 5 state machine implementation is completed
- **THEN** the backend exposes `assign`, `dispatch`, `mark-delivered`, `mark-not-delivered` and `cancel` endpoints and each endpoint updates state and writes history in one transaction

#### Scenario: Delivery summary report endpoint is proposed
- **WHEN** delivery reporting contracts are reviewed
- **THEN** it includes `GET /api/deliveries/reports/summary`

#### Scenario: Summary report remains deferred
- **WHEN** Fase 5 state machine implementation is completed
- **THEN** `GET /api/deliveries/reports/summary` is still not implemented

#### Scenario: Summary report placeholder is protected
- **WHEN** Fase 6A backend permissions are implemented
- **THEN** `GET /api/deliveries/reports/summary` exists only as a permission-gated placeholder and advanced reporting remains deferred

### Requirement: Delivery DTO contract
The system SHALL document delivery DTO shapes and SHALL implement the Fase 5 action DTOs for assignment, dispatch, delivered, not-delivered and cancellation.

#### Scenario: Create DTO is documented
- **WHEN** `CreateDeliveryDto` is reviewed
- **THEN** it includes source identifiers, branch, contact/address snapshot, delivery fee source, payment status, payment method, assigned user and notes

#### Scenario: Action DTOs are documented
- **WHEN** delivery action DTOs are reviewed
- **THEN** `AssignDeliveryDto`, `DispatchDeliveryDto`, `MarkDeliveryDeliveredDto`, `MarkDeliveryNotDeliveredDto` and `CancelDeliveryDto` define the minimum fields for their transitions

#### Scenario: Action DTOs are implemented
- **WHEN** Fase 5 state machine implementation is completed
- **THEN** the backend has DTOs for assign, dispatch, mark-delivered, mark-not-delivered and cancel with `class-validator` validations for UUIDs, required reasons, optional notes and optional metadata

#### Scenario: Query and response DTOs are documented
- **WHEN** list and report contracts are reviewed
- **THEN** `DeliveryFiltersDto`, `DeliveryResponseDto` and `DeliverySummaryReportDto` define filters, response summary and reporting metrics

### Requirement: Delivery indexes and constraints
The system SHALL implement base delivery indexes and constraints for tenant-safe querying and operational performance using direct PostgreSQL DDL.

#### Scenario: Core indexes are proposed
- **WHEN** future database design is reviewed
- **THEN** it proposes indexes for tenant, customer, order, sale, invoice, cash session, status and lifecycle timestamps

#### Scenario: Composite indexes are proposed
- **WHEN** list, report and operational filters are reviewed
- **THEN** it proposes composite indexes such as `(tenant_id, status, created_at)`, `(tenant_id, customer_id)`, `(tenant_id, order_id)`, `(tenant_id, invoice_id)` and `(tenant_id, cash_session_id)`

#### Scenario: Active order delivery uniqueness is documented
- **WHEN** order delivery cardinality is reviewed
- **THEN** the design proposes a future partial uniqueness rule that prevents more than one active delivery per order in v0.0.1

### Requirement: Delivery audit model proposal
The system SHALL document minimum audit data for lifecycle actors, timestamps, reasons and status history.

#### Scenario: Direct audit fields are documented
- **WHEN** the `deliveries` model is reviewed
- **THEN** it includes direct fields for creator, dispatcher, deliverer, canceller, not-delivered actor and relevant timestamps

#### Scenario: Status history is recommended
- **WHEN** lifecycle traceability is reviewed
- **THEN** `delivery_status_history` is recommended from the initial technical design for state changes and sensitive actions

### Requirement: Backend implementation plan and base runtime
The system SHALL document the backend implementation plan and implement only the approved Fase 4 base runtime for Domicilios.

#### Scenario: Candidate backend files are listed
- **WHEN** the backend plan is reviewed
- **THEN** it lists candidate module, controller, service, repository, entity, DTO and test files under a future `api/src/modules/deliveries` area

#### Scenario: Backend service responsibilities are listed
- **WHEN** future services are reviewed
- **THEN** the plan defines responsibilities for `DeliveriesService`, `DeliveryStateMachineService`, `DeliveryNumberService`, `DeliveryCashIntegrationService` and `DeliveryAuditService`

#### Scenario: Backend implementation order is listed
- **WHEN** implementation sequencing is reviewed
- **THEN** the plan starts with migrations and types, then DTOs, state machine, repository, service, controller, permissions, tests and validation

#### Scenario: Runtime scope stays limited
- **WHEN** Fase 4 base implementation is completed
- **THEN** runtime changes are limited to the deliveries module, initial DTOs, service, controller, direct SQL migration and AppModule registration

#### Scenario: State machine runtime is implemented
- **WHEN** Fase 5 state machine implementation is completed
- **THEN** runtime changes remain limited to the deliveries module and add only state action endpoints, DTOs, transition validation, transactional history and focused backend tests

### Requirement: Backend acceptance criteria
The system SHALL document acceptance criteria for future backend implementation before runtime work begins.

#### Scenario: Backend criteria are reviewed
- **WHEN** future implementation is evaluated
- **THEN** criteria include strict OpenSpec validation, tenant isolation, valid transitions, active order uniqueness, permission enforcement, no duplicate delivery fee and backend tests

