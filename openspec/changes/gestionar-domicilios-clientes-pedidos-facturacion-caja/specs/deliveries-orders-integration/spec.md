## ADDED Requirements

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
- **WHEN** an order linked to a delivery is cancelled while the delivery is `PENDIENTE` or `EN_PREPARACION`
- **THEN** the delivery should move to `CANCELADO` with traceability in a future implementation

#### Scenario: Order cancels after dispatch
- **WHEN** an order cancellation is requested after delivery is `DESPACHADO`
- **THEN** the future implementation must require an explicit delivery resolution such as `NO_ENTREGADO` or a supervised exception

#### Scenario: Delivery cancels before fulfillment
- **WHEN** a delivery linked to an order is cancelled before dispatch
- **THEN** the order remains available for non-delivery handling according to existing order rules

### Requirement: No order implementation in this phase
The system SHALL NOT modify order APIs, services, SQL functions, frontend pages or order permissions during this OpenSpec-only phase.

#### Scenario: Order integration is validated
- **WHEN** this change is validated
- **THEN** order behavior remains documentation-only and existing order flows stay untouched
