# deliveries-order-current-cash Specification

## ADDED Requirements

### Requirement: Order-created deliveries inherit current cash context

Deliveries created from orders during an open cash session SHALL be associated with the current cash session context.

#### Scenario: Order belongs to current cash session and delivery is created

- **GIVEN** an order linked to the current open cash session
- **WHEN** the user creates a delivery from that order
- **THEN** the delivery stores `cash_session_id`, `cash_register_id`, and `terminal_id`

#### Scenario: Delivery appears in current cash scope

- **GIVEN** a delivery created from an order has the current `cash_session_id`
- **WHEN** the user lists deliveries with `cash_scope=current`
- **THEN** the delivery is returned

#### Scenario: Zero fee delivery contributes zero to closing

- **GIVEN** an order-created delivery has `delivery_fee = 0`
- **WHEN** the delivery is associated with the current cash session
- **THEN** `cash_impact_amount` is `0`

### Requirement: Delivery current cash scope includes logistics

The current cash delivery scope SHALL include logistics operations associated with the current cash session, even when cash impact is zero.

#### Scenario: Zero fee delivery appears in current scope

- **GIVEN** a delivery has `delivery_fee = 0`
- **AND** the delivery has the current `cash_session_id`
- **WHEN** deliveries are listed with `cash_scope=current`
- **THEN** the delivery appears in the list

#### Scenario: Delivery without cash session is excluded

- **GIVEN** a delivery has no `cash_session_id`
- **WHEN** deliveries are listed with `cash_scope=current`
- **THEN** the delivery does not appear in the list

#### Scenario: Delivery from another cash session is excluded

- **GIVEN** a delivery belongs to another cash session
- **WHEN** deliveries are listed with `cash_scope=current`
- **THEN** the delivery does not appear in the list

### Requirement: Cross-session delivery protection

The system SHALL prevent silently moving deliveries or orders between cash sessions.

#### Scenario: Existing delivery with another cash session is not reassigned

- **GIVEN** an existing delivery has a different `cash_session_id`
- **WHEN** the user tries to manage it as current cash delivery from the order
- **THEN** the request is rejected

#### Scenario: Order from another cash session is rejected

- **GIVEN** an order belongs to another cash session
- **WHEN** the user tries to create a delivery for it in the current cash session
- **THEN** the request is rejected with an explicit session mismatch message

#### Scenario: Initial legacy delivery can be completed safely

- **GIVEN** an existing delivery from the order has no `cash_session_id`
- **AND** the delivery is still in its initial status
- **WHEN** the user creates the order delivery from the current cash session
- **THEN** the existing delivery receives the current cash context instead of creating a duplicate

### Requirement: No cash total duplication

Associating an order-created delivery with cash session SHALL NOT duplicate order or sale totals in cash closing.

#### Scenario: Zero fee contributes zero

- **GIVEN** a delivery has `delivery_fee = 0`
- **WHEN** it is included in the current cash operational scope
- **THEN** it contributes zero to cash closing

#### Scenario: Delivery fee is the only cash impact

- **GIVEN** a delivery has `delivery_fee > 0`
- **WHEN** it is summarized for closing
- **THEN** only `delivery_fee` is used as delivery cash impact

#### Scenario: Order total is not duplicated

- **GIVEN** a delivery is associated with an order
- **WHEN** cash closing summarizes deliveries
- **THEN** the order total is not added again through the delivery
