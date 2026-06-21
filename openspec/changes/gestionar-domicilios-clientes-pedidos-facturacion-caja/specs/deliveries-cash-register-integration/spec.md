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

### Requirement: Delivery cash fields are documented
The system SHALL document future cash-related fields for deliveries without creating payment or cash movement behavior in this phase.

#### Scenario: Cash session field is optional
- **WHEN** a delivery has no collection, refund, adjustment or reconciliation
- **THEN** `cash_session_id` remains absent and no cash impact is implied

#### Scenario: Cash session field is required by collection
- **WHEN** a future delivery records payment on delivery into an active turn
- **THEN** the delivery or payment event must reference an authorized `cash_session_id`

#### Scenario: Payment status is explicit
- **WHEN** a delivery is paid before dispatch, paid on delivery or pending reconciliation
- **THEN** `payment_status` documents that money state independently from the delivery status

### Requirement: Delivery payment event table is conditional
The system SHALL document `delivery_payment_events` as a candidate table for collection and reconciliation history.

#### Scenario: Simple prepaid delivery
- **WHEN** delivery is prepaid in POS or invoice
- **THEN** a separate delivery payment event table is not required for v0.0.1 operation

#### Scenario: Contraentrega is implemented
- **WHEN** future implementation supports payment on delivery or courier collection
- **THEN** `delivery_payment_events` should be considered for expected amount, collected amount, difference, actor, payment method and cash session

### Requirement: Cash closing avoids duplicate delivery income
The system SHALL require future cash design to distinguish billed delivery fees from separate delivery collections.

#### Scenario: Delivery fee is already billed and paid
- **WHEN** a delivery fee was included and paid through POS or invoice
- **THEN** cash reports must not add it again as separate delivery income

#### Scenario: Separate delivery collection exists
- **WHEN** a delivery fee is collected outside the original sale or invoice
- **THEN** the future cash flow must show the collection source and reconciliation status

### Requirement: Backend cash integration plan
The system SHALL document future backend cash safeguards without creating cash movements in the planning phase.

#### Scenario: Cash integration service is planned
- **WHEN** backend services are reviewed
- **THEN** the plan includes `DeliveryCashIntegrationService` to validate fee source, payment status, cash session and duplicate-income risks

#### Scenario: Cash movement creation is deferred
- **WHEN** future delivery backend is first implemented
- **THEN** it must not create cash movements until a cash integration phase approves exact accounting rules

#### Scenario: Cash tests are planned
- **WHEN** backend tests are planned
- **THEN** they include cases proving no movement is created for invoice-included or no-fee deliveries and no duplicate income is recorded
