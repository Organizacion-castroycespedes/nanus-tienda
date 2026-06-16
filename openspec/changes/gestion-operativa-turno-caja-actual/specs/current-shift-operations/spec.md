## ADDED Requirements

### Requirement: Resolve current open cash session
The system SHALL expose an operative current shift query that resolves the authorized open cash session for the authenticated actor and never returns a session from another tenant.

#### Scenario: User has open cash session
- **WHEN** USER requests current shift with an open cash session in their tenant and authorized branch
- **THEN** the response includes `hasOpenCashSession: true`, cash session metadata, summary, and tab containers scoped to that cash session

#### Scenario: No open cash session
- **WHEN** an authorized actor requests current shift without an open cash session
- **THEN** the response includes `hasOpenCashSession: false` and an operative message without throwing a 500 error

#### Scenario: Cross-tenant request is rejected
- **WHEN** an actor requests a tenant or cash session outside their allowed tenant scope
- **THEN** the backend rejects the request with Forbidden

### Requirement: Current shift tab data
The system SHALL return current shift tabs for sales, orders, purchases, movements, cash count, and tickets using only data associated to the resolved open cash session.

#### Scenario: Sales are associated to open cash session
- **WHEN** the open cash session has POS sales or payments linked by `cash_session_id`
- **THEN** the sales tab includes only those rows and totals

#### Scenario: Orders and purchases need payment or movement linkage
- **WHEN** orders or purchases do not have a direct cash session relation
- **THEN** the system includes them only when a payment or cash movement links them to the open cash session

#### Scenario: Empty tabs are valid
- **WHEN** a tab has no rows associated to the open cash session
- **THEN** the response returns an empty rows array and zero total for that tab

### Requirement: Current shift frontend view
The web app SHALL provide an operative "Gestion del turno" view for authorized roles with summary cards, tabs, empty states, and a CTA to POS context selection when there is no open cash session.

#### Scenario: Open session view
- **WHEN** USER, ADMIN, SUPER_USER, or allowed SUPER_ADMIN opens `/{tenant}/finance/current-shift` with an authorized open cash session
- **THEN** the page shows cash session metadata, summary cards, and tabs for Ventas, Pedidos, Compras, Movimientos, Arqueo, and Tickets

#### Scenario: No open session CTA
- **WHEN** the actor opens the view without an open cash session
- **THEN** the page shows an operative empty state and a CTA to `/{tenant}/pos/select-context`

### Requirement: Current shift ticket actions
The system SHALL expose ticket actions only for entities with existing authorized ticket endpoints.

#### Scenario: Ticket is available
- **WHEN** a sales, order, purchase, cash count, or closing ticket exists and the user is authorized
- **THEN** the UI allows viewing, downloading, and printing the ticket using existing PDF endpoints

#### Scenario: Ticket is not applicable
- **WHEN** a ticket is not available for a row or open session state
- **THEN** the UI disables or omits the action without creating an incomplete endpoint

### Requirement: Current shift QA evidence
The change SHALL document manual QA by role without marking unexecuted flows as PASS.

#### Scenario: Manual QA recorded
- **WHEN** QA is executed for USER, ADMIN, SUPER_USER, or SUPER_ADMIN
- **THEN** evidence records state, environment, tested routes, tested endpoints, ticket results, and real pending items
