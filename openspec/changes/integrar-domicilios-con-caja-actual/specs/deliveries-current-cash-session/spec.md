## ADDED Requirements

### Requirement: Delivery operations use current cash session
The system SHALL associate cash-impacting delivery operations with the current open cash session.

#### Scenario: Open cash session creates cash-impact delivery
- **WHEN** a user with a current open cash session creates a delivery with `delivery_fee > 0`
- **THEN** the delivery records the current `cash_session_id`
- **AND** the delivery records the related cash register and terminal when available

#### Scenario: Payment method requires cash session
- **WHEN** a delivery create request includes `payment_method_id`
- **THEN** the system requires a current open cash session

#### Scenario: No open cash session blocks cash impact
- **WHEN** a user without a current open cash session creates a delivery with cash impact
- **THEN** the system rejects the operation with a clear message

#### Scenario: Logistic access remains available
- **WHEN** an authorized user has no current open cash session
- **THEN** delivery list, detail, and delivery ticket access remain available according to permissions

### Requirement: Delivery list current cash scope
The delivery list SHALL show or filter deliveries according to current cash session scope.

#### Scenario: POS/USER current cash default
- **WHEN** a POS/USER has a current open cash session
- **THEN** the delivery list can request only deliveries from that cash session

#### Scenario: Delivery without cash context is labeled
- **WHEN** a delivery has no `cash_session_id`
- **THEN** the UI labels it as `Sin caja`

#### Scenario: Admin can inspect all deliveries
- **WHEN** an administrative user has permission
- **THEN** the UI can request all deliveries and labels `Caja actual`, `Sin caja`, or `Otra caja`

#### Scenario: Other cash sessions are not mixed
- **WHEN** a non-admin user works in current cash mode
- **THEN** deliveries from other cash sessions are not mixed into the current operational list

### Requirement: Cash closing includes delivery summary
The cash closing process SHALL include delivery cash impact without duplicating sale totals.

#### Scenario: Delivered delivery fees are summarized
- **WHEN** a delivery assigned to the cash session is delivered
- **THEN** its `delivery_fee` contributes to the delivery summary for cash closing

#### Scenario: Cancelled deliveries are excluded
- **WHEN** a delivery assigned to the cash session is cancelled
- **THEN** its `delivery_fee` does not contribute to collected delivery totals

#### Scenario: Not delivered deliveries are excluded
- **WHEN** a delivery assigned to the cash session is not delivered
- **THEN** its `delivery_fee` does not contribute to collected delivery totals

#### Scenario: Sale totals are not duplicated
- **WHEN** a delivery has `sale_id` or `order_id`
- **THEN** only `delivery_fee` is summarized for delivery cash impact
- **AND** `subtotal` and sale/order totals are not added again

#### Scenario: Delivery totals group by payment method
- **WHEN** delivered deliveries have `payment_method_id`
- **THEN** the delivery summary groups delivered fees by payment method

### Requirement: Cash closing ticket includes delivery section
The cash closing ticket SHALL include a delivery summary section.

#### Scenario: Ticket shows delivery counts
- **WHEN** a cash closing ticket is generated
- **THEN** it shows delivered, pending/dispatched, and cancelled/not-delivered delivery counts

#### Scenario: Ticket shows delivery fee total
- **WHEN** a cash closing ticket is generated
- **THEN** it shows collected delivery fee total

#### Scenario: Ticket shows payment method breakdown
- **WHEN** delivered delivery fees have payment methods
- **THEN** the ticket shows delivery totals grouped by payment method

#### Scenario: Existing sections remain unchanged
- **WHEN** the delivery section is added
- **THEN** existing cash closing ticket sections remain available
