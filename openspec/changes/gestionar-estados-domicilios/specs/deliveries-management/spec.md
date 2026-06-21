## MODIFIED Requirements

### Requirement: Delivery state model
The system SHALL define the operational delivery states as `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO` and `CANCELADO`.

#### Scenario: Initial delivery state
- **WHEN** a delivery is registered and no dispatch action has occurred
- **THEN** the delivery starts as `CREADO`
- **AND** legacy `CREATED` values are treated as `CREADO` during compatibility reads

#### Scenario: Preparation is not courier assignment
- **WHEN** a delivery moves to `EN_PREPARACION`
- **THEN** the state represents store preparation only
- **AND** the system does not require or create courier assignment as part of this change

#### Scenario: Operational states are shown to operators
- **WHEN** the list, detail, filters or action controls show delivery status
- **THEN** the UI shows operational labels derived from `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO` and `CANCELADO`
- **AND** it does not show technical legacy values such as `CREATED`, `ASSIGNED`, `DISPATCHED`, `DELIVERED`, `NOT_DELIVERED` or `CANCELLED`

#### Scenario: Legacy state values are compatible during rollout
- **WHEN** persisted deliveries still contain legacy English state values
- **THEN** the backend and frontend map `CREATED` to `CREADO`, `ASSIGNED` to `EN_PREPARACION`, `DISPATCHED` to `DESPACHADO`, `DELIVERED` to `ENTREGADO`, `NOT_DELIVERED` to `NO_ENTREGADO` and `CANCELLED` to `CANCELADO`
- **AND** filters and detail views continue to work without exposing another tenant

### Requirement: Delivery state transitions
The system SHALL allow only documented delivery state transitions and SHALL record traceability for every transition.

#### Scenario: Created delivery advances or cancels
- **WHEN** a delivery is in `CREADO`
- **THEN** it can transition only to `EN_PREPARACION`, `DESPACHADO` or `CANCELADO`

#### Scenario: Preparation delivery advances or cancels
- **WHEN** a delivery is in `EN_PREPARACION`
- **THEN** it can transition only to `DESPACHADO` or `CANCELADO`

#### Scenario: Dispatched delivery closes
- **WHEN** a delivery is in `DESPACHADO`
- **THEN** it can transition only to `ENTREGADO` or `NO_ENTREGADO`

#### Scenario: Not-delivered delivery can retry only when allowed
- **WHEN** a delivery is in `NO_ENTREGADO` and retry is explicitly allowed by the delivery rule
- **THEN** it can transition to `DESPACHADO`
- **AND** the retry writes a new transition history row

#### Scenario: Not-delivered retry is blocked when not allowed
- **WHEN** a delivery is in `NO_ENTREGADO` and retry is not explicitly allowed
- **THEN** the UI does not show retry action
- **AND** the backend rejects a retry attempt with a clear invalid-transition error

#### Scenario: Final states stay closed
- **WHEN** a delivery is in `ENTREGADO` or `CANCELADO`
- **THEN** the state cannot change
- **AND** no state-change action is shown

#### Scenario: Invalid transition is blocked
- **WHEN** a user or client attempts a transition not listed for the current state
- **THEN** the backend rejects the change
- **AND** the delivery status and timestamps remain unchanged

#### Scenario: Transition trace is captured
- **WHEN** a delivery changes state
- **THEN** the transition records actor, previous state, new state, timestamp and reason or observation when applicable

### Requirement: Delivery list and detail UX
The system SHALL provide a Domicilios UI with a list, filters, detail view, actions by state, creation flow, empty states and responsive behavior consistent with Manus POS.

#### Scenario: Delivery list filters records
- **WHEN** an authorized user opens the delivery list
- **THEN** the UI offers filters for status, customer, date, order or invoice, responsible user and cash session when applicable
- **AND** the status filter uses `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO` and `CANCELADO`

#### Scenario: Detail shows operational trace
- **WHEN** an authorized user opens a delivery detail
- **THEN** the UI shows customer summary, delivery address, source document, status, responsible user, payment/shipping information, timestamps, observations and transition history when available

#### Scenario: Actions respect state
- **WHEN** a delivery is shown in the list or detail view
- **THEN** only actions allowed for the current state and permissions are enabled

#### Scenario: Created delivery actions are visible
- **WHEN** an authorized user views a `CREADO` delivery
- **THEN** the UI shows allowed actions for enviar a preparacion, despachar and cancelar

#### Scenario: Preparation delivery actions are visible
- **WHEN** an authorized user views an `EN_PREPARACION` delivery
- **THEN** the UI shows allowed actions for despachar and cancelar

#### Scenario: Dispatched delivery actions are visible
- **WHEN** an authorized user views a `DESPACHADO` delivery
- **THEN** the UI shows allowed actions for marcar entregado and marcar no entregado

#### Scenario: Final delivery actions are hidden
- **WHEN** an authorized user views an `ENTREGADO` or `CANCELADO` delivery
- **THEN** the UI does not show state-change actions

#### Scenario: Action feedback is clear
- **WHEN** a state-change action succeeds or fails
- **THEN** the UI shows a message that explains the result using operational wording
- **AND** it does not expose raw backend enum names as the main message

#### Scenario: Responsive view avoids horizontal overflow
- **WHEN** the delivery UI is used on mobile or narrow screens
- **THEN** tables, filters and action controls adapt without horizontal overflow

### Requirement: Delivery technical transition fields
The system SHALL record mandatory fields for dispatch, delivery, cancellation and not-delivered transitions.

#### Scenario: Dispatch transition fields are required
- **WHEN** a delivery transitions to `DESPACHADO`
- **THEN** the contract records dispatch actor when available and `dispatched_at`

#### Scenario: Delivered transition fields are required
- **WHEN** a delivery transitions to `ENTREGADO`
- **THEN** the contract records delivery actor when available and `delivered_at`

#### Scenario: Cancel transition fields are required
- **WHEN** a delivery transitions to `CANCELADO`
- **THEN** the contract records cancellation actor when available, `cancelled_at` and cancellation reason when required

#### Scenario: Not-delivered transition fields are required
- **WHEN** a delivery transitions to `NO_ENTREGADO`
- **THEN** the contract records not-delivered actor when available, `failed_at` and not-delivered reason when required

#### Scenario: Preparation transition is traced
- **WHEN** a delivery transitions to `EN_PREPARACION`
- **THEN** the transition is written to status history with actor and timestamp
- **AND** no courier assignment field is required

### Requirement: Delivery API contract
The system SHALL implement delivery CRUD and state-change APIs that are tenant-safe and server-authoritative.

#### Scenario: Delivery CRUD endpoints are available
- **WHEN** the technical API contract is reviewed
- **THEN** it includes `GET /api/deliveries`, `POST /api/deliveries`, `GET /api/deliveries/:id` and `PATCH /api/deliveries/:id`

#### Scenario: Delivery list endpoint filters by status
- **WHEN** an authenticated actor calls `GET /api/deliveries?status=CREADO`
- **THEN** the backend returns only records for the authenticated tenant matching `CREADO` or compatible legacy `CREATED`
- **AND** the endpoint also supports filters for `branch_id`, `customer_id`, `order_id`, `sale_id`, `date_from`, `date_to`, `page` and `limit` when available

#### Scenario: Delivery list can filter by source sale
- **WHEN** an authenticated actor calls `GET /api/deliveries?sale_id=...`
- **THEN** the backend filters deliveries by the linked sales document without exposing other tenants

#### Scenario: Delivery create endpoint sets initial state
- **WHEN** an authenticated actor calls `POST /api/deliveries` with valid delivery creation data
- **THEN** the backend creates a `CREADO` delivery and writes the initial `delivery_status_history` row in the same transaction

#### Scenario: Delivery detail endpoint is tenant-safe
- **WHEN** an authenticated actor calls `GET /api/deliveries/:id`
- **THEN** the backend returns the delivery only when the id belongs to the actor tenant

#### Scenario: Delivery detail can be resolved from a sale source
- **WHEN** the backend needs to show delivery from a billed sales document
- **THEN** the delivery can be resolved through the linked `sale_id` without changing the delivery lifecycle

#### Scenario: Delivery update endpoint does not change status
- **WHEN** an authenticated actor calls `PATCH /api/deliveries/:id`
- **THEN** the backend permits only non-status editable delivery fields
- **AND** it does not allow status changes through the generic update endpoint

#### Scenario: Delivery state-change API is implemented
- **WHEN** an authenticated actor invokes a delivery state-change endpoint or action endpoint
- **THEN** the backend validates tenant scope, permission, current state, requested transition and required reason fields
- **AND** it updates state, timestamps and history in one transaction

#### Scenario: Delivery state-change API covers required transitions
- **WHEN** the state-change API is reviewed
- **THEN** it can perform `CREADO -> EN_PREPARACION`, `CREADO -> DESPACHADO`, `CREADO -> CANCELADO`, `EN_PREPARACION -> DESPACHADO`, `EN_PREPARACION -> CANCELADO`, `DESPACHADO -> ENTREGADO`, `DESPACHADO -> NO_ENTREGADO` and allowed `NO_ENTREGADO -> DESPACHADO`

#### Scenario: Existing action endpoints remain compatible
- **WHEN** existing action endpoints such as `assign`, `dispatch`, `mark-delivered`, `mark-not-delivered` or `cancel` are retained
- **THEN** they enforce the new operational transition rules
- **AND** the frontend labels those actions with operational wording rather than endpoint names

#### Scenario: Summary report remains deferred
- **WHEN** state management implementation is completed
- **THEN** delivery summary reporting remains unchanged unless already implemented outside this change

### Requirement: Delivery DTO contract
The system SHALL document and implement DTO shapes needed for delivery creation, listing, response and state-change actions.

#### Scenario: Create DTO uses initial state implicitly
- **WHEN** `CreateDeliveryDto` is reviewed
- **THEN** it includes source identifiers, branch, contact/address snapshot, delivery fee source, payment status, payment method, assigned user if already supported and notes
- **AND** it does not require the client to provide a raw initial status

#### Scenario: State-change DTOs are available
- **WHEN** delivery state-change DTOs are reviewed
- **THEN** they define the minimum fields for preparation, dispatch, delivered, not-delivered, retry and cancellation transitions

#### Scenario: Reason fields are validated
- **WHEN** a cancellation or not-delivered transition is requested
- **THEN** the backend validates required reason or observation fields according to the transition contract

#### Scenario: Query and response DTOs expose operational states
- **WHEN** list and detail contracts are reviewed
- **THEN** `DeliveryFiltersDto` and `DeliveryResponseDto` expose operational status values and do not require operators to use legacy English enum values

## ADDED Requirements

### Requirement: Delivery state QA evidence
The change SHALL document technical and manual QA evidence for operational delivery state management.

#### Scenario: QA evidence file is updated
- **WHEN** implementation is completed or validation is blocked
- **THEN** `docs/evidencia-qa-gestionar-estados-domicilios.md` records executed checks, pending manual checks and known blockers

#### Scenario: Excluded modules are documented
- **WHEN** QA evidence is written
- **THEN** it states that caja, POS, facturacion electronica, payments and functional order rules were not changed by this delivery state work

#### Scenario: Manual PASS is not claimed without execution
- **WHEN** browser or role-based manual QA is not executed
- **THEN** the evidence marks it as pending or blocked instead of PASS
