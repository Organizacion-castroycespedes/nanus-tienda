## ADDED Requirements

### Requirement: Cash session required for operational mutations
The system SHALL require a current open cash session for operational mutations that affect sales, orders, purchases, payments, deliveries, or cash.

#### Scenario: USER without open cash session cannot create an order
- **WHEN** a USER calls the order creation endpoint without an open cash session
- **THEN** the backend rejects the request

#### Scenario: USER without open cash session cannot pay or invoice an order
- **WHEN** a USER calls payment or order invoice endpoints without an open cash session
- **THEN** the backend rejects the request

#### Scenario: USER without open cash session cannot create or receive a purchase
- **WHEN** a USER calls purchase mutation endpoints without an open cash session
- **THEN** the backend rejects the request

#### Scenario: USER without open cash session cannot create a sale or payment
- **WHEN** a USER calls sale or payment creation endpoints without an open cash session
- **THEN** the backend rejects the request

#### Scenario: Read-only views remain accessible
- **WHEN** a user opens list/detail/report endpoints
- **THEN** access is controlled by existing permissions
- **AND** no cash session is required

### Requirement: Backend enforcement
The backend SHALL enforce the cash-session requirement independently from frontend UI restrictions.

#### Scenario: Direct API call without valid cash session is rejected
- **WHEN** a direct API call reaches a protected mutation without valid cash session
- **THEN** the backend rejects it with an explicit message

#### Scenario: Closed or foreign cash session is rejected
- **WHEN** the request context does not match an open cash session for the user and tenant
- **THEN** the backend rejects the operation

#### Scenario: Valid current cash session allows operation
- **WHEN** the user has a valid current open cash session
- **THEN** the protected operation can proceed to its existing business validations

### Requirement: Frontend operational lock
The frontend SHALL guide users when an operation requires an open cash session.

#### Scenario: User sees clear cash required message
- **WHEN** backend rejects an operation because caja is required
- **THEN** the UI shows an actionable error message

#### Scenario: Read-only views remain usable
- **WHEN** no caja is open
- **THEN** list/detail views remain visible according to permissions

### Requirement: No administrative data loss
The cash-session requirement SHALL not remove administrative visibility or historical consultation.

#### Scenario: Existing data remains visible
- **WHEN** authorized users view orders, purchases, deliveries, tickets, or reports
- **THEN** historical data remains available
