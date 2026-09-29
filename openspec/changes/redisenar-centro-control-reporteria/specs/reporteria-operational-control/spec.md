## ADDED Requirements

### Requirement: Secure consolidated snapshot
The system SHALL expose an additive operational-control snapshot for the reporteria landing page and SHALL enforce effective scope from authenticated actor claims in backend and PostgreSQL.

#### Scenario: User sees only authorized data
- **WHEN** a `USER` requests the snapshot with another tenant, branch, cashier or terminal identifier
- **THEN** the request is rejected or the identifiers are ignored according to the existing authorization contract, and no other-tenant data is returned

#### Scenario: Administrative scope
- **WHEN** `ADMIN`, `SUPER_USER` or `SUPER_ADMIN` requests an authorized scope
- **THEN** the response is limited respectively to authorized branch, tenant, or authorized global tenant/branch scope

### Requirement: Period and metric contract
The snapshot SHALL support `TODAY`, `LAST_7_DAYS` and `LAST_30_DAYS`, return resolved bounds and timezone, and distinguish zero, unavailable, empty and error states. It SHALL return only source-backed net sales, transaction count, open cash sessions, active cashiers, pending orders, cash differences, and bounded purchase/customer summaries.

#### Scenario: Today series
- **WHEN** period is `TODAY`
- **THEN** the sales series uses hourly COT buckets and includes zero-valued buckets inside the resolved range

#### Scenario: Thirty-day series
- **WHEN** period is `LAST_30_DAYS`
- **THEN** the series uses daily buckets and respects half-open date bounds without inventing future values

#### Scenario: No records
- **WHEN** an authorized scope has no records
- **THEN** metrics contain real zero values and charts contain empty series with an explicit empty state

### Requirement: Operational charts
The system SHALL return sales evolution, sales by payment method, cash movements, and orders by state. Mixed payments SHALL NOT duplicate transaction or net-sales totals. Series SHALL carry readable labels, numeric values and enough metadata for accessible text alternatives.

#### Scenario: Mixed payment sale
- **WHEN** one sale has multiple payment rows
- **THEN** it contributes one transaction and one net-sale total while payment-method rows sum only the payment allocation values

#### Scenario: Permission-limited chart
- **WHEN** the actor lacks access to a chart source
- **THEN** that chart is marked unavailable and is not populated with fabricated values

### Requirement: Responsive accessible landing page
The reporteria landing page SHALL keep the existing navigation and specialized routes, place compact quick links below the header, avoid horizontal scrolling, and render chart cards in two columns only when actual available width allows legible cards.

#### Scenario: Narrow POS viewport
- **WHEN** the page is rendered in a narrow terminal or mobile container
- **THEN** cards and filters reflow to one column, controls remain touchable and charts use one column without clipped labels

#### Scenario: Desktop viewport
- **WHEN** the usable content width supports two legible chart cards
- **THEN** charts render two per row while the sidebar and page padding remain accounted for

### Requirement: Reconciliation and compatibility
The snapshot SHALL preserve existing specialized report contracts and SHALL provide tests proving sales, cash, payment, period, empty and scope totals reconcile for matching authorized filters.

#### Scenario: Specialized report remains available
- **WHEN** a user navigates to POS, Caja, Compras, Pedidos or Clientes
- **THEN** the existing route and response contract remain usable

#### Scenario: Invalid period or scope
- **WHEN** a request contains reversed bounds, unsupported period, malformed UUID or unauthorized scope
- **THEN** backend returns a client or forbidden error without executing an unsafe query

### Requirement: Role-aware attribution and hierarchical filters
The snapshot SHALL return the effective tenant, branch, cashier/user and terminal filters and SHALL apply the same intersection to all applicable KPIs, charts and detail rows. Filter options SHALL be hierarchical and server-authorized.

#### Scenario: USER remains actor-scoped
- **WHEN** a `USER` requests another cashier, tenant or branch
- **THEN** the server rejects the out-of-scope filter or returns no widened data, and the response exposes no other cashier or terminal option.

#### Scenario: ADMIN attributes activity inside its branch
- **WHEN** an `ADMIN` selects a cashier or terminal
- **THEN** sales and cash rows identify branch, terminal and cashier/user, while a different branch or tenant cannot be selected or returned.

#### Scenario: SUPER_USER selects branch then operator
- **WHEN** a `SUPER_USER` selects a branch belonging to its tenant and then a cashier or terminal
- **THEN** dependent options and all four charts use that branch intersection, and another tenant is rejected.

#### Scenario: SUPER_ADMIN selects tenant hierarchy
- **WHEN** a `SUPER_ADMIN` selects tenant, branch, cashier/user and terminal in that order
- **THEN** each child selection is limited to the selected parent and the dashboard keeps the selected tenant scope.

#### Scenario: Parent filter changes invalidate children
- **WHEN** tenant or branch changes
- **THEN** incompatible branch, cashier and terminal selections are cleared before the next snapshot request.

### Requirement: Bounded sales and cash detail
The snapshot SHALL return a deterministic bounded recent sales detail and cash-movement detail using real source relations, with a navigation link to the specialized report for each block.

#### Scenario: Administrative sales attribution
- **WHEN** an administrative role loads an authorized snapshot
- **THEN** each representative sales row can show date/time, branch, terminal, cashier/user, transaction count and amount.

#### Scenario: Cash movement attribution
- **WHEN** an authorized snapshot contains cash movements
- **THEN** each representative row can show date/time, branch, terminal, cashier/user, movement type, direction and amount, with income and expense semantics accessible without color alone.

#### Scenario: Bounded empty detail
- **WHEN** the authorized scope has no sales or cash movements
- **THEN** each detail block shows an explicit empty state and does not download an unbounded dataset.
