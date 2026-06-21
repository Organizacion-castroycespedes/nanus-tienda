## ADDED Requirements

### Requirement: Delivery operational reports
The system SHALL define future reports for pending, in-preparation, dispatched, delivered, cancelled and not-delivered deliveries.

#### Scenario: Pending deliveries report
- **WHEN** an authorized user opens future delivery reporting
- **THEN** the user can review deliveries by current state, date range, customer, zone, responsible user and source document

#### Scenario: Dispatched deliveries report
- **WHEN** an authorized user filters dispatched deliveries
- **THEN** the report shows dispatch time, responsible user or courier, customer, zone and elapsed time since dispatch

#### Scenario: Cancelled and not-delivered reports
- **WHEN** an authorized user reviews cancelled or not-delivered deliveries
- **THEN** the report includes reason, actor, source document and financial resolution status when applicable

### Requirement: Delivery collection reports
The system SHALL define future reports for delivery revenue, courier collection, cash session reconciliation and collection differences.

#### Scenario: Collection by delivery
- **WHEN** an authorized user reviews delivery collection
- **THEN** the report shows expected amount, collected amount, payment method, delivery fee and difference status

#### Scenario: Collection by courier
- **WHEN** an authorized user filters by responsible user or courier
- **THEN** the report totals deliveries, collected amounts, pending reconciliation and differences for that responsible actor

#### Scenario: Collection by cash session
- **WHEN** an authorized user filters by cash session or turn
- **THEN** the report shows delivery-related collections and differences associated to that cash context

### Requirement: Delivery performance reports
The system SHALL define future reports for average delivery time, deliveries by customer and deliveries by zone or neighborhood.

#### Scenario: Average delivery time
- **WHEN** an authorized user opens performance reporting
- **THEN** the report can show average time from creation to dispatch and from dispatch to delivery

#### Scenario: Deliveries by customer
- **WHEN** an authorized user filters deliveries by customer
- **THEN** the report shows delivery count, last delivery date, status distribution and zones used by that customer

#### Scenario: Deliveries by zone
- **WHEN** an authorized user filters deliveries by zone or neighborhood
- **THEN** the report shows counts, delivered rate, not-delivered rate and average time by zone

### Requirement: No reporting implementation in this phase
The system SHALL NOT modify `backend-reporteria`, report endpoints, report SQL, report UI or PDF generation during this OpenSpec-only phase.

#### Scenario: Reporting design is validated
- **WHEN** this change is validated
- **THEN** delivery reporting remains documentation-only and existing reports stay untouched

### Requirement: Delivery summary API report proposal
The system SHALL document a future delivery summary report contract for operational and cash-oriented metrics.

#### Scenario: Summary endpoint is reviewed
- **WHEN** the future endpoint `GET /api/deliveries/reports/summary` is reviewed
- **THEN** the contract includes totals by state, delivery count, delivery fee totals, expected collection, collected amount, differences and average delivery times

#### Scenario: Summary filters are reviewed
- **WHEN** summary filters are reviewed
- **THEN** the contract supports date range, status, customer, zone, responsible user, branch and cash session when applicable
