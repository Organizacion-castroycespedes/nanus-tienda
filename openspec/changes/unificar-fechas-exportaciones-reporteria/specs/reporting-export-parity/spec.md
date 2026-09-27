## ADDED Requirements

### Requirement: Screen and exports share the effective report dataset
The reporting system SHALL use the same effective filters, tenant and branch scope, permissions, status criteria, record definition and aggregation rules for the interactive result, PDF and Excel.

#### Scenario: Filter parity
- **WHEN** a user exports a report after applying date, status, tenant or branch filters
- **THEN** PDF and Excel receive and apply the same effective filters as the loaded report

#### Scenario: Complete export
- **WHEN** a user exports without an explicit page-export option
- **THEN** the document contains every record matching the effective filters, not only the visible page

#### Scenario: Snapshot consistency
- **WHEN** new transactions arrive while an export is being generated
- **THEN** all export batches and their totals use the existing consistent snapshot mechanism

### Requirement: Pagination does not change report totals
The reporting system SHALL keep summary totals based on the complete filtered dataset while pagination only controls visible rows.

#### Scenario: Page navigation
- **WHEN** the user changes page or page size
- **THEN** the summary, effective period and export dataset definition remain unchanged

#### Scenario: Empty or invalid result
- **WHEN** validation fails or no records match
- **THEN** no invalid SQL executes and the screen, PDF and Excel use the same empty or validation outcome

### Requirement: Tenant and branch isolation remains enforced
The reporting system SHALL preserve the existing authorization, tenant, branch, status and cash-session scope for screen and export queries.

#### Scenario: Cross-tenant identifier
- **WHEN** a request supplies an identifier outside the authorized tenant
- **THEN** the report excludes it or rejects it through existing authorization behavior in both screen and exports

#### Scenario: Branch scope
- **WHEN** a user is restricted to a branch
- **THEN** screen, PDF and Excel contain only records from that branch while retaining real opening, closing, payment and audit timestamps

### Requirement: Excel timestamps use explicit effective timezone presentation
Report Excel generators SHALL write report period boundaries and timestamp columns as values formatted in the effective business timezone, including an explicit timezone label, and SHALL NOT rely on Excel serializing a JavaScript `Date` without timezone context.

#### Scenario: POS Excel regression
- **WHEN** a POS sale is stored at `2026-09-26T05:00:00.000Z`
- **THEN** Excel presents the sale as midnight on 26/09/2026 in `America/Bogota`, matching the PDF and screen rather than 05:00

#### Scenario: Exclusive end boundary
- **WHEN** a historical report ends on 26/09/2026
- **THEN** Excel shows the exclusive boundary as 27/09/2026 00:00 in `America/Bogota` and does not include records from that next day

#### Scenario: Cross-module timestamp presentation
- **WHEN** Excel is generated for caja, auditorías, compras, pedidos or ventas operativas
- **THEN** every available timestamp column and period summary uses the same explicit timezone formatting, while caja keeps real opening, closing and counted instants
