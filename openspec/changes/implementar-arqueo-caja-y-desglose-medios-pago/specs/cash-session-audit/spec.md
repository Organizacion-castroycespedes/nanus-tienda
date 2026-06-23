## ADDED Requirements

### Requirement: Current cash session audit preview
The system SHALL allow a cashier to review an audit preview for the current open cash session without closing it.

#### Scenario: Cashier opens audit preview for current cash session
- **WHEN** a cashier opens the audit action for an open cash session
- **THEN** the system shows expected cash amount and payment method breakdown
- **AND** the cash session remains open

#### Scenario: Cashier enters counted cash amount
- **WHEN** the cashier enters counted cash amount
- **THEN** the system shows preliminary difference
- **AND** the system does not close the cash session

#### Scenario: Audit preview does not mutate operations
- **WHEN** the audit preview is opened or calculated
- **THEN** sales, orders, deliveries, purchases, payments, inventory, and invoice state remain unchanged

### Requirement: Payment method breakdown
The cash audit and closing views SHALL separate cash from non-cash payment methods.

#### Scenario: Cash payments contribute to expected physical cash
- **WHEN** a payment method is classified as cash
- **THEN** its IN payments increase expected physical cash
- **AND** its OUT payments decrease expected physical cash

#### Scenario: Non-cash payments do not affect physical cash
- **WHEN** a payment method is transfer, card, digital wallet, or other non-cash method
- **THEN** it is shown separately
- **AND** it does not affect expected physical cash

#### Scenario: Deliveries use delivery fee only
- **WHEN** deliveries are included in cash session breakdown
- **THEN** only delivered `delivery_fee` values are counted
- **AND** sale/order totals are not duplicated

### Requirement: Cash closing detail clarity
The cash closing process SHALL present clear totals by origin and payment method before final close.

#### Scenario: Closing shows origin totals
- **WHEN** a user opens close cash session
- **THEN** the view shows POS sales, orders, purchases, deliveries, and manual movements

#### Scenario: Closing shows cash expected and difference
- **WHEN** a user enters counted cash
- **THEN** the view shows expected cash, counted cash, and difference
- **AND** expected cash excludes non-cash payments

### Requirement: Cash closing ticket payment breakdown
The cash closing ticket SHALL include payment method breakdown and expected cash details.

#### Scenario: Ticket shows cash details
- **WHEN** the closing ticket is generated
- **THEN** it shows expected cash, counted cash, and cash difference

#### Scenario: Ticket shows non-cash methods separately
- **WHEN** non-cash methods exist
- **THEN** the ticket lists them separately from cash
- **AND** existing ticket sections remain available

### Requirement: Cash audit records
The system SHALL store audit records without closing the cash session.

#### Scenario: Audit record stores snapshot
- **WHEN** a user saves an audit
- **THEN** the system stores expected cash, counted cash, difference, notes, and breakdown snapshot
- **AND** the cash session remains open

#### Scenario: Audit record does not close cash session
- **WHEN** an audit record is created
- **THEN** no cash closing is created
- **AND** no closing movement is created
