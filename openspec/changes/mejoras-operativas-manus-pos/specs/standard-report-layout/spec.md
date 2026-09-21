## ADDED Requirements

### Requirement: Reusable report composition
The design system or equivalent shared report module SHALL provide a reusable composition for Report Header, Report Toolbar with filters/actions, Report Summary, Report Data/Table, Loading/Empty/Error states and existing Pagination.

For POS-oriented viewports, the standard composition SHALL keep the toolbar compact, render the summary as one compact horizontal band when the width permits, and give the data table visual priority immediately after the summary. Summary helper copy SHALL remain available through accessible labels or equivalent non-invasive help, not as tall permanent cards.

Report filters SHALL be defined by report metadata rather than inferred from table columns. The metadata SHALL identify each filter key, label, type or renderer, priority, active value and clear behavior. Primary filters SHALL stay in the compact toolbar; secondary filters SHALL be collapsed behind a responsive control and active values SHALL be exposed as removable chips.

#### Scenario: New report is created
- **WHEN** a new report is implemented
- **THEN** its design SHALL evaluate and reuse the standard composition when compatible

#### Scenario: POS report is viewed at operational desktop width
- **WHEN** the report is viewed between 1024px and 1280px wide
- **THEN** filters and actions SHALL share a compact toolbar, the four summary metrics SHALL use one compact band, and the table SHALL be the dominant content with reusable pagination

#### Scenario: Secondary report filters are collapsed
- **WHEN** a report has secondary filters such as tenant, branch, terminal or cash register
- **THEN** those filters SHALL stay hidden by default behind a `Filtros` control, preserve the report's existing filter semantics, and expose active selections as compact removable chips

#### Scenario: Existing report is redesigned later
- **WHEN** an existing report is migrated or redesigned
- **THEN** its implementation SHALL evaluate and reuse the standard composition without requiring a mass migration in this change

### Requirement: Progressive adoption preserves report contracts
The caja, compras, pedidos and clientes reports SHALL adopt the standard composition progressively while preserving their existing service calls, query parameters, permissions, columns, actions and real summary fields.

#### Scenario: Cash report is adopted
- **WHEN** `/reporteria/caja` uses the standard composition
- **THEN** its closings/audits tabs, date/tenant/branch filters, PDF tickets, Excel exports and tab-specific real summaries remain available

#### Scenario: Purchases report is adopted
- **WHEN** `/reporteria/compras` uses the standard composition
- **THEN** its date/status/tenant/branch filters, purchase ticket actions, export and payment/receipt fields remain unchanged in meaning

#### Scenario: Orders report is adopted
- **WHEN** `/reporteria/pedidos` uses the standard composition
- **THEN** its date/tenant/branch filters, generated-sale state, ticket actions and order status summaries remain unchanged in meaning

#### Scenario: Customers report is adopted
- **WHEN** `/reporteria/clientes` uses the standard composition
- **THEN** its tenant/branch/customer document/customer name filters and customer-order aggregates remain unchanged in meaning, without adding a date filter or invented metric

### Requirement: Standard report export uses a safe complete filtered snapshot
Document exports SHALL use the same tenant, branch, date, permission and report-specific filter semantics as the Web query, but SHALL obtain the complete filtered dataset through a real count plus bounded batches inside a read-only repeatable-read snapshot. UI pagination SHALL NOT limit the document. Exports SHALL reject datasets above 100000 rows and SHALL never truncate silently.

#### Scenario: POS export matches the filtered Web scope
- **WHEN** an authorized user opens the POS report action with active filters
- **THEN** PDF preview, PDF download, Excel download and print SHALL represent the complete result of those same filters and scope, independent of the visible UI page

#### Scenario: POS export exceeds the safe limit
- **WHEN** the filtered POS count is greater than 100000 rows
- **THEN** the backend SHALL abort with a user-facing domain error asking for narrower filters

#### Scenario: POS export reads multiple real batches
- **WHEN** the filtered POS dataset requires more than one 1000-row batch
- **THEN** all batches SHALL be read in one `REPEATABLE READ READ ONLY` snapshot and their count SHALL equal the initial count

### Requirement: Standard report documents preserve corporate context
Document preview, PDF and Excel SHALL use the active tenant and branch corporate context when available, including logo, legal name, tax identification and available contact fields, with a clean empty-field fallback. Individual POS tickets and accepted electronic documents SHALL remain separate actions.

#### Scenario: POS document has corporate branding
- **WHEN** the tenant has configured company details or logo
- **THEN** the document header SHALL use those values and SHALL NOT use demo tenant data

#### Scenario: POS document has incomplete branding
- **WHEN** one or more corporate fields are absent
- **THEN** the document SHALL omit those fields without inventing replacement values

### Requirement: POS is the first standard document export adoption
The POS report SHALL expose one compact `Reporte` action that opens the reusable PDF preview with Cerrar, Descargar PDF, Descargar Excel and Imprimir, while preserving its existing filters, summary, pagination, individual ticket and accepted electronic-document actions. Caja Cierres, Caja Arqueos, Compras, Pedidos and Clientes SHALL be adopted only after the POS pipeline is certified.

#### Scenario: POS pilot is implemented before later reports
- **WHEN** the standard document export phase is delivered incrementally
- **THEN** `/reporteria/pos` is the first report using the safe export pipeline and the other five report variants remain unchanged until the pilot is certified

#### Scenario: POS PDF fits operational report columns
- **WHEN** the POS document has the seven contractual list columns
- **THEN** its configured PDF orientation SHALL fit all columns, repeat the table header, keep each sale row indivisible, and show readable tenant and branch names without technical UUIDs

#### Scenario: POS report action replaces legacy reconciliation download
- **WHEN** the user opens the POS report toolbar
- **THEN** the compact `Reporte` action SHALL provide preview, PDF, Excel and print actions and the legacy reconciliation button SHALL not be rendered

### Requirement: Caja uses separate safe document definitions for Cierres and Arqueos
The Caja report SHALL preserve its existing tabs and Web filters while using separate document definitions for Cierres and Arqueos. Each definition SHALL use the active tab dataset, the same actor/tenant/branch/date scope as Web, complete filtered rows rather than the visible UI page, real 1000-row batches inside one `REPEATABLE READ READ ONLY` snapshot, the shared 100000-row limit, corporate branding and the reusable preview actions.

#### Scenario: Caja Cierres exports its own dataset
- **WHEN** the Cierres tab is active and the user opens `Reporte`
- **THEN** PDF preview, PDF download, Excel download and print SHALL contain only the filtered cash-session closing rows and their real closing summaries, with repeated headers and indivisible rows

#### Scenario: Caja Arqueos exports its own dataset
- **WHEN** the Arqueos tab is active and the user opens `Reporte`
- **THEN** PDF preview, PDF download, Excel download and print SHALL contain only the filtered cash-count audit rows and their real audit summaries, without mixing Cierres columns or data

#### Scenario: Caja export preserves scope and safe batching
- **WHEN** an authorized user exports either Caja tab
- **THEN** actor permissions, tenant, branch and date semantics SHALL match the Web report, count and batches SHALL use the same stable order in one read-only repeatable-read snapshot, and results above 100000 rows SHALL fail without silent truncation

#### Scenario: Caja document shows corporate context
- **WHEN** the active tenant has branding or branch details
- **THEN** the document SHALL show available company, NIT and branch names without technical UUIDs or invented fallback data

### Requirement: Compras uses a safe complete document export
The Compras report SHALL expose one compact document action that preserves its date, status, tenant and branch filters, keeps supplier as a data column rather than an invented filter, and exposes the real supplier invoice number as an optional partial-search filter. Each row SHALL expose supplier invoice number and invoice date from `purchases`. PDF, Excel and print SHALL share the complete filtered dataset and corporate context, while legacy exports and purchase tickets remain available.

#### Scenario: Compras export preserves the Web scope
- **WHEN** an authorized user exports Compras with date, status, tenant and branch filters
- **THEN** PDF preview, PDF download, Excel download and print SHALL use the same actor permissions, scope, stable ordering and complete filtered rows as the Web report, independent of UI pagination
- **AND** a blank invoice-number filter SHALL not restrict results, while a non-blank filter SHALL use the same case-insensitive partial matching in Web, PDF and Excel

#### Scenario: Compras export is safely bounded
- **WHEN** the filtered Compras count is greater than 100000 rows
- **THEN** the export SHALL fail explicitly without truncating, and otherwise read real batches of at most 1000 rows within one `REPEATABLE READ READ ONLY` snapshot

#### Scenario: Compras documents preserve real fields and branding
- **WHEN** the Compras document is rendered
- **THEN** it SHALL include only contractual purchase fields, supplier, real totals and available tenant/branch branding, with repeated headers and indivisible rows; missing branding fields SHALL be omitted
- **AND** invoice number SHALL remain full text in Excel, invoice date SHALL remain a spreadsheet date when present, and missing invoice values SHALL use the report's neutral display

#### Scenario: Compras PDF and Excel render independently
- **WHEN** the user requests either PDF or XLSX
- **THEN** only the requested renderer SHALL execute, and existing purchase tickets and legacy export actions SHALL remain available
