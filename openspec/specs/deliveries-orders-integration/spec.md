# deliveries-orders-integration Specification

## Purpose
TBD - created by archiving change gestionar-domicilios-clientes-pedidos-facturacion-caja. Update Purpose after archive.
## Requirements
### Requirement: Orders can conceptually generate deliveries
The system SHALL define that a customer order can generate a delivery when the order requires shipment or home delivery.

#### Scenario: Delivery is created from confirmed order
- **WHEN** a future authorized user marks a confirmed order as requiring delivery
- **THEN** the system can create a delivery linked to that order with order summary, customer data and delivery address snapshot

#### Scenario: Delivery is created manually for order
- **WHEN** a user creates a delivery manually and selects an order
- **THEN** the delivery links to the order without changing order business logic in this phase

### Requirement: One active delivery per order in v0.0.1
The system SHALL treat one active delivery per order as the v0.0.1 design baseline and SHALL defer multiple deliveries or partial delivery routing.

#### Scenario: Order already has active delivery
- **WHEN** a future user attempts to create another active delivery for the same order
- **THEN** the system blocks the duplicate or directs the user to the existing delivery

#### Scenario: Multiple delivery need appears
- **WHEN** an order requires partial deliveries or multiple routes
- **THEN** the need is recorded as future scope and not implemented in v0.0.1

### Requirement: Delivery status visibility in orders
The system SHALL define that order screens can show delivery status as related operational information without replacing order status.

#### Scenario: Order has delivery
- **WHEN** an order has a linked delivery
- **THEN** the order view can show the delivery status, responsible user, dispatch timestamp and delivery timestamp when available

#### Scenario: Delivery changes state
- **WHEN** a linked delivery changes state
- **THEN** the order can reflect the new delivery status as a badge or related section without forcing an order status transition

### Requirement: Order cancellation and delivery cancellation rules
The system SHALL document cancellation behavior between orders and deliveries before implementation.

#### Scenario: Order cancels before dispatch
- **WHEN** an order linked to a delivery is cancelled while the delivery is `CREATED` or `ASSIGNED`
- **THEN** the delivery should move to `CANCELLED` with traceability in a future implementation

#### Scenario: Order cancels after dispatch
- **WHEN** an order cancellation is requested after delivery is `DISPATCHED`
- **THEN** the future implementation must require an explicit delivery resolution such as `NOT_DELIVERED` or a supervised exception

#### Scenario: Delivery cancels before fulfillment
- **WHEN** a delivery linked to an order is cancelled before dispatch
- **THEN** the order remains available for non-delivery handling according to existing order rules

### Requirement: No order implementation in Fase 4
The system SHALL NOT modify order APIs, services, SQL functions, frontend pages or order permissions during Fase 4.

#### Scenario: Order integration is validated
- **WHEN** this change is validated
- **THEN** order behavior remains documentation-only and existing order flows stay untouched

### Requirement: Order delivery technical relationship
The system SHALL document a future `deliveries.order_id` relationship and same-tenant validation for order-linked deliveries.

#### Scenario: Delivery references order
- **WHEN** a future delivery is linked to an order
- **THEN** `deliveries.order_id` references the order and both records must belong to the same tenant

#### Scenario: Active delivery uniqueness is enforced in future design
- **WHEN** a future order already has an active delivery in `DRAFT`, `CREATED`, `ASSIGNED` or `DISPATCHED`
- **THEN** the system must prevent creating another active delivery for that order in v0.0.1

#### Scenario: Final delivery allows later design decision
- **WHEN** a linked delivery is `DELIVERED`, `CANCELLED` or `NOT_DELIVERED`
- **THEN** any additional delivery or retry behavior requires an explicit future rule before implementation

### Requirement: Backend order integration plan
The system SHALL document backend safeguards for order-linked deliveries before runtime implementation.

#### Scenario: Order tenant validation is planned
- **WHEN** a future delivery references `orderId`
- **THEN** the backend plan requires the service to verify the order exists and belongs to the same tenant

#### Scenario: Active delivery check is planned
- **WHEN** a future delivery is created for an order
- **THEN** the backend plan requires checking for existing active deliveries before insert

#### Scenario: Order cancellation risk is planned
- **WHEN** order cancellation integration is implemented later
- **THEN** the backend plan requires an explicit rule for linked deliveries before changing order runtime behavior

### Requirement: Backend can create and query delivery from order
The system SHALL expose controlled backend endpoints to create and query the delivery associated with an order without changing existing order lifecycle behavior.

#### Scenario: Authorized user queries order delivery
- **WHEN** an authorized user calls `GET /api/orders/:id/delivery` with `DELIVERIES_VIEW`
- **THEN** the system returns the delivery linked to that order or `null` when none exists
- **AND** the lookup is scoped by `tenant_id`

#### Scenario: Authorized user creates delivery from order
- **WHEN** an authorized user calls `POST /api/orders/:id/delivery` with `DELIVERIES_CREATE`
- **THEN** the system creates a `CREATED` delivery linked to the order
- **AND** the delivery stores a snapshot of customer contact and delivery address data

#### Scenario: Order address is incomplete
- **WHEN** the order/customer snapshot does not provide enough delivery address data
- **THEN** the create request must provide `delivery_address`

#### Scenario: Order belongs to another tenant
- **WHEN** a user tries to create or query delivery for an order outside the authenticated tenant
- **THEN** the system rejects the request

#### Scenario: Order already has delivery
- **WHEN** any delivery already exists for the order
- **THEN** the system rejects creating another delivery for the same order in v0.0.1
- **AND** this includes deliveries in final states until a future retry/historical rule is approved

#### Scenario: Order flow remains unchanged
- **WHEN** a delivery is created or queried from an order
- **THEN** the system does not change order creation, order status, POS, invoicing, cash register, inventory or financial movements

