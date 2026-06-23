# orders-purchases-current-cash-scope Specification

## ADDED Requirements

### Requirement: Orders current cash scope

The orders list SHALL show orders for the current open cash session by default for operational users.

#### Scenario: USER with open cash session sees current orders

- **GIVEN** a USER has an open cash session
- **WHEN** the user opens the orders list
- **THEN** only orders linked to that cash session are shown

#### Scenario: USER without open cash session does not see historical orders as current operation

- **GIVEN** a USER has no open cash session
- **WHEN** the user opens the orders list
- **THEN** historical orders are not shown as current operation

#### Scenario: Admin can explicitly switch to all orders

- **GIVEN** an authorized admin user opens orders
- **WHEN** the user selects all scope
- **THEN** historical orders are shown according to permissions

### Requirement: Purchases current cash scope

The purchases list SHALL show purchases for the current open cash session by default for operational users.

#### Scenario: USER with open cash session sees current purchases

- **GIVEN** a USER has an open cash session
- **WHEN** the user opens the purchases list
- **THEN** only purchases linked to that cash session are shown

#### Scenario: USER without open cash session does not see historical purchases as current operation

- **GIVEN** a USER has no open cash session
- **WHEN** the user opens the purchases list
- **THEN** historical purchases are not shown as current operation

#### Scenario: Admin can explicitly switch to all purchases

- **GIVEN** an authorized admin user opens purchases
- **WHEN** the user selects all scope
- **THEN** historical purchases are shown according to permissions

### Requirement: Backend cash scope enforcement

The backend SHALL enforce cash-scope filters for orders and purchases independently of frontend UI.

#### Scenario: Current scope resolves authenticated user session

- **GIVEN** the request uses `cashScope=current`
- **WHEN** the backend handles the list request
- **THEN** it resolves the authenticated user's current open cash session

#### Scenario: Cross-user cash session filter is rejected

- **GIVEN** a request provides a cash session not owned by the authenticated user
- **WHEN** the backend handles the request
- **THEN** the request is rejected

#### Scenario: All scope requires authorization

- **GIVEN** an operational USER requests `cashScope=all`
- **WHEN** the backend handles the request
- **THEN** the request is rejected

#### Scenario: Tenant isolation is preserved

- **GIVEN** a user requests orders or purchases
- **WHEN** the backend filters by cash scope
- **THEN** only records from the authorized tenant are returned

### Requirement: New operational records link to cash session

New operational orders and purchases SHALL be linked to the current cash session when created.

#### Scenario: New order stores cash session

- **GIVEN** a user has an open cash session
- **WHEN** the user creates an order
- **THEN** the order stores `cash_session_id`

#### Scenario: New purchase stores cash session

- **GIVEN** a user has an open cash session
- **WHEN** the user creates a purchase
- **THEN** the purchase stores `cash_session_id`

#### Scenario: Legacy records remain unchanged

- **GIVEN** existing orders or purchases have no cash session
- **WHEN** the migration runs
- **THEN** the records remain valid and unchanged
