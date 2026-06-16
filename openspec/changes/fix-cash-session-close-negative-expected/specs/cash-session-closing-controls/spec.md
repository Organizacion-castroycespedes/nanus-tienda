## ADDED Requirements

### Requirement: Cash session close normalizes negative expected amount
The finance API SHALL close an open cash session without raising an internal server error when the computed summary expected amount is negative.

#### Scenario: Negative expected amount closes successfully
- **WHEN** `POST /api/finance/cash-sessions/:id/close` receives a valid `closingAmount`
- **AND** the cash session summary has `totals.expectedAmount < 0`
- **THEN** the service SHALL persist `expectedAmount` as `0`
- **AND** the service SHALL persist `differenceAmount` as `closingAmount - 0`
- **AND** the API SHALL NOT fail with `cash_sessions_expected_amount_check`

#### Scenario: Non-negative expected amount remains unchanged
- **WHEN** `POST /api/finance/cash-sessions/:id/close` receives a valid `closingAmount`
- **AND** the cash session summary has `totals.expectedAmount >= 0`
- **THEN** the service SHALL persist the computed expected amount unchanged
- **AND** the service SHALL calculate the difference against that persisted value

### Requirement: Cash count mirrors closed session totals
The finance API SHALL create the related cash count using the same normalized expected amount and difference amount persisted in the closed cash session.

#### Scenario: Cash count uses normalized expected amount
- **WHEN** a cash session is closed from a summary with negative expected amount
- **THEN** the `cash_counts.expected_amount` value SHALL be `0`
- **AND** the `cash_counts.difference_amount` value SHALL match the closed session difference amount

### Requirement: Zero closing amount does not create invalid cash movement
The finance API SHALL NOT attempt to insert a zero-amount `CLOSING` row into `cash_movements`.

#### Scenario: Closing amount zero is persisted without movement insert
- **WHEN** `POST /api/finance/cash-sessions/:id/close` receives `closingAmount = 0`
- **THEN** the service SHALL close the cash session
- **AND** the service SHALL create the cash count
- **AND** the service SHALL NOT call the cash movement insert for a `CLOSING` movement
- **AND** the API SHALL NOT fail with `cash_movements_amount_check`

#### Scenario: Positive closing amount still creates closing movement
- **WHEN** `POST /api/finance/cash-sessions/:id/close` receives `closingAmount > 0`
- **THEN** the service SHALL create a `CLOSING` cash movement with that positive amount
