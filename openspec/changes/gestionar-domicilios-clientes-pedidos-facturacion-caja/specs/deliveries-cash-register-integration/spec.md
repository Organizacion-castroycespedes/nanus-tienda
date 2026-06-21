## ADDED Requirements

### Requirement: Delivery cash impact is explicit
The system SHALL define that a delivery affects cash only when there is a delivery fee, payment on delivery, refund, adjustment or courier collection to reconcile.

#### Scenario: Delivery is prepaid
- **WHEN** the order, sale or invoice was paid before dispatch
- **THEN** the delivery records prepaid context and does not create a separate cash collection by itself

#### Scenario: Delivery is paid on delivery
- **WHEN** the customer pays at delivery
- **THEN** the future system must capture expected amount, collected amount, payment method, responsible user or courier and cash session or reconciliation target

#### Scenario: Delivery has no cash impact
- **WHEN** delivery is free or internal-only
- **THEN** no cash movement is implied by delivery state changes

### Requirement: Current cash session association
The system SHALL associate a delivery to the current cash session only when the delivery operation affects the active turn.

#### Scenario: Cashier collects delivery payment
- **WHEN** a cashier records payment for a delivery during an open cash session
- **THEN** the future system links the payment or movement to the authorized cash session

#### Scenario: Courier collects money outside cashier session
- **WHEN** a courier collects money outside the cashier session
- **THEN** the future system must define a reconciliation flow before money enters the cash turn

#### Scenario: No open cash session
- **WHEN** a delivery action would collect or refund money but there is no authorized open cash session or reconciliation target
- **THEN** the future system blocks the cash-affecting action or marks it pending reconciliation according to approved rules

### Requirement: Cash differences are traceable
The system SHALL require traceability for differences between invoiced amount, delivery fee, expected collection and actual collection.

#### Scenario: Collected amount differs from expected amount
- **WHEN** the collected delivery amount differs from the expected amount
- **THEN** the future system records the difference, reason and actor for cash review

#### Scenario: No entregado with prepaid amount
- **WHEN** a prepaid delivery becomes `NO_ENTREGADO`
- **THEN** the future system flags refund, credit note or retry decision without automatically changing cash

#### Scenario: Cancelled delivery with shipping fee
- **WHEN** a delivery is `CANCELADO` and a shipping fee was charged
- **THEN** the future system requires a financial resolution path before closing the case

### Requirement: No cash implementation in this phase
The system SHALL NOT modify cash sessions, payments, cash movements, cash reports or close-turn logic during this OpenSpec-only phase.

#### Scenario: Cash integration is validated
- **WHEN** this change is validated
- **THEN** cash behavior remains documentation-only and existing cash flows stay untouched
