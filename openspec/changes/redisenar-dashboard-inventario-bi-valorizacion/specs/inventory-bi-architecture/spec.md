## ADDED Requirements

### Requirement: Section 1 visual shell

Section 1 SHALL render the new Inventory BI shell in place at `/{tenant}/inventory` with the hierarchy Header, Filtros de inventario placeholder, six-card KPI shell, Distribución del capital group heading and shell, Salud operativa group heading and shell, Valorización de Inventario CTA shell, and Inventario operational table shell. The Header SHALL sit directly on the page background without a card border or shadow. Section 1 SHALL use structural skeletons and SHALL NOT display fabricated metrics, amounts, products, percentages, charts, or operational rows.

#### Scenario: Visual shell review
- **WHEN** an authorized user opens `/{tenant}/inventory` during Section 1
- **THEN** the complete BI hierarchy SHALL be visible with neutral structural placeholders and no fake business data

#### Scenario: Valuation CTA before route implementation
- **WHEN** the user sees the valuation CTA in Section 1
- **THEN** the CTA SHALL be disabled, visibly muted through the existing disabled Button variant, non-navigating, and accessible until the valuation route is implemented

### Requirement: Section 1 responsive and state foundation

The shell SHALL use existing tenant design tokens, the existing `Button` component, the existing `lucide-react` icon library, semantic headings, visible focus behavior, responsive grid/flex layout, and no structural absolute positioning. It SHALL provide stable loading skeletons and a reusable error panel with the exact message `No fue posible cargar el Dashboard de Inventario.` and optional retry action.

#### Scenario: Responsive shell
- **WHEN** the viewport changes across desktop, tablet, compact mobile, and sub-480px widths
- **THEN** the shell SHALL reflow without body horizontal overflow and SHALL preserve hierarchy and readable controls; wide columns SHALL activate from the Inventory BI content container's usable inline width, not from viewport width alone

#### Scenario: Loading state
- **WHEN** the shell is loading
- **THEN** skeletons SHALL preserve layout structure and SHALL not replace the full view with a plain loading message

#### Scenario: Error state
- **WHEN** the shell receives an error state
- **THEN** Header and structural context SHALL remain visible and the compact error panel SHALL offer retry only when a callback exists

### Requirement: Section 0 is architecture-only

Section 0 SHALL document architecture, data contracts, scope, pagination, valuation, export, route preservation, and incremental delivery. It SHALL NOT authorize production code, physical SQL functions, migrations, visual implementation, staging, commit, or push.

#### Scenario: Section 0 review
- **WHEN** Section 0 is reviewed
- **THEN** only OpenSpec artifacts and validated architectural decisions SHALL be in scope

### Requirement: Inventory route replacement

The future Inventory BI Dashboard SHALL replace the existing experience at `/{tenant}/inventory`. The implementation SHALL NOT create a parallel dashboard and SHALL preserve the existing route guard, permissions, global layout behavior, and all existing Inventory child routes.

#### Scenario: Navigate to inventory
- **WHEN** an authorized user opens `/{tenant}/inventory`
- **THEN** the route SHALL remain the principal Inventory entry point

#### Scenario: Child route preservation
- **WHEN** an authorized user opens an existing Inventory child route
- **THEN** that route and its current capabilities SHALL remain reachable and operational

### Requirement: Current capability preservation matrix

The implementation plan SHALL classify current `/inventory` capabilities as PRESERVAR, REUBICAR, REEMPLAZAR VISUALMENTE, or GAP. No current capability SHALL be authorized for deletion in Section 0.

The matrix SHALL cover scope filters, loading/error states, stock total, inventory cost, low stock, out-of-stock products, pending purchases/orders, sales, active cash, recent movements, lot alerts, reconciliation, quick links, charts, and operational lists.

#### Scenario: Replace dashboard presentation
- **WHEN** the dashboard visual structure changes
- **THEN** each current capability SHALL have a preserved or explicitly relocated/replaced destination

### Requirement: Inventory BI business focus

The future BI experience SHALL primarily answer how much inventory exists, how much it is worth, where it is distributed, where capital is concentrated, and what requires attention. Sales, cash, purchases, orders, and other existing capabilities MAY remain as secondary operational context, but SHALL NOT define the economic valuation read model.

#### Scenario: Read economic dashboard
- **WHEN** a user reads the BI dashboard
- **THEN** inventory quantity, inventory value, distribution, concentration, and attention signals SHALL be primary

### Requirement: Shared Inventory BI base read model

The architecture SHALL define one shared Inventory BI base semantic dataset containing tenant, branch, product, category when available, real stock, real unit cost, inventory cost, and stock status. The base model SHALL normalize the dataset only.

The base model SHALL NOT materialize the complete dataset as JSONB, SHALL NOT paginate, and SHALL NOT contain dashboard-specific KPIs or charts.

#### Scenario: Shared semantics
- **WHEN** dashboard summary, operational detail, valuation, or export needs inventory rows
- **THEN** each consumer SHALL use the same base semantics for scope, stock, cost, and status

### Requirement: Conceptual stored-function architecture

The architecture SHALL use the conceptual flow `inventory_scope -> inventory_bi_base -> inventory_bi_summary / inventory_bi_products_page / inventory_valuation_count / inventory_valuation_batch`.

These names SHALL remain conceptual in Section 0. Physical function names SHALL be chosen later using repository SQL conventions.

#### Scenario: Implement later
- **WHEN** a later section creates SQL functions
- **THEN** it SHALL choose reviewed physical names and SHALL not treat the conceptual names as authorization to create them now

### Requirement: Backend economic source of truth

Stock and cost SHALL come exclusively from contractual backend sources demonstrated by repository evidence. `stockTotal` SHALL represent quantity. Economic inventory value SHALL be derived backend-side using the equivalent formula `real_stock * real_unit_cost`.

The frontend SHALL NOT recalculate valuation. Negative stock SHALL remain negative and SHALL NOT be silently converted to zero.

#### Scenario: Calculate valuation
- **WHEN** a backend read model returns real stock and real unit cost
- **THEN** backend output SHALL calculate inventory value from those values

#### Scenario: Negative stock
- **WHEN** real stock is negative
- **THEN** the BI and valuation contracts SHALL preserve the negative value unless a separately approved business rule says otherwise

### Requirement: Specialized current valuation route

The target valuation view SHALL be `/{tenant}/inventory/valuation` as an architectural recommendation, subject to later route-permission and menu strategy implementation. It SHALL represent current inventory valuation, not historical valuation.

The future CTA from `/inventory` SHALL navigate to the valuation view and SHALL NOT open a PDF directly. A DateRangePicker SHALL NOT be required for valuation unless a later functional decision approves historical or period-based behavior.

#### Scenario: Use valuation CTA
- **WHEN** a user activates the future valuation CTA
- **THEN** the application SHALL navigate to the specialized valuation view

### Requirement: Summary aggregation

KPIs, cost by branch, cost by category, Top N products, state distribution, and health counts SHALL be resolved through specialized aggregates over the base read model. Small aggregate outputs MAY use rows, arrays, or structured JSON, but SHALL NOT include the complete product dataset.

#### Scenario: Summary response
- **WHEN** the dashboard requests summary data
- **THEN** the response SHALL contain only the required aggregate outputs and SHALL not embed all product rows

### Requirement: Server-side pagination

KPIs, branch/category cost aggregates, Top N products, state distribution, and health counts SHALL NOT be paginated. The `/inventory` operational table, valuation table, and product drilldowns SHALL use real server-side pagination with `LIMIT/OFFSET` or the repository-standard equivalent.

#### Scenario: Request valuation page
- **WHEN** a user requests a valuation page
- **THEN** the backend SHALL fetch only the requested page and pagination metadata

#### Scenario: Avoid memory pagination
- **WHEN** a future page is implemented
- **THEN** it SHALL NOT load the complete dataset and slice it in frontend or backend memory

### Requirement: Complete document export

Future PDF/XLSX exports SHALL use the complete filtered dataset independently of web pagination. Export SHALL perform a count first, use batch size 1000, enforce `MAX_REPORT_EXPORT_ROWS=100000` or the repository's configured equivalent, use one `REPEATABLE READ READ ONLY` transaction, rollback on failure, and explicitly reject over-limit output without truncation.

Exports SHALL reuse the certified `DocumentExportService` and reportería standard when implementation begins. They SHALL NOT use full-dataset `jsonb_agg` and SHALL NOT export only the visible page.

#### Scenario: Export complete result
- **WHEN** an authorized user exports a filtered valuation
- **THEN** PDF/XLSX SHALL include the complete filtered dataset, not only the visible web page

#### Scenario: Export exceeds limit
- **WHEN** the count exceeds the configured maximum
- **THEN** export SHALL be rejected explicitly and SHALL not truncate silently

### Requirement: Backend-enforced role scope

The backend SHALL enforce role scope for `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN`. `ADMIN` SHALL use its real tenant and permitted branches. `SUPER_USER` SHALL use tenants and branches permitted by demonstrated repository rules. `SUPER_ADMIN` SHALL support global scope with optional tenant and branch filters.

The frontend SHALL control UX only. It SHALL NOT be treated as authorization. POS scope resolver reuse SHALL require demonstrated semantic equivalence with Inventory.

#### Scenario: Unauthorized branch
- **WHEN** an actor requests a branch outside its authorized membership
- **THEN** the backend SHALL reject the request before returning inventory data

#### Scenario: Privileged filter
- **WHEN** `SUPER_ADMIN` supplies a tenant or branch filter
- **THEN** the backend SHALL resolve and enforce that requested global scope

### Requirement: BI reconciliation consistency

For the same scope and filters, future implementation tests SHALL prove that total inventory cost equals the sum by branch, the sum by category, and the sum of the complete detail dataset. Total units SHALL equal the sum of real stock in the complete detail dataset.

#### Scenario: Cost reconciliation
- **WHEN** the same scope is queried through summary, branch, category, and detail datasets
- **THEN** all inventory cost totals SHALL reconcile exactly according to the approved numeric precision

#### Scenario: Unit reconciliation
- **WHEN** the detail dataset is complete for the same scope
- **THEN** KPI units SHALL equal the sum of detail real stock

### Requirement: Performance discipline

Section 0 SHALL introduce no materialized views, summary tables, persistent caching, or new indexes. Future implementation SHALL follow definitive SQL, `EXPLAIN (ANALYZE, BUFFERS)`, evidence, and only then optimization. Materialized views or cache SHALL require measured cost justification, especially for global scope.

#### Scenario: Optimize later
- **WHEN** a performance issue is reported
- **THEN** optimization SHALL be based on query evidence and SHALL not be introduced speculatively in Section 0

### Requirement: Database read security

Future inventory BI reads SHALL prefer read-only functions, parameterized SQL, and `SECURITY INVOKER` by default. `SECURITY DEFINER` SHALL require demonstrated need, explicit `search_path`, ownership, `EXECUTE` permissions, and threat review.

#### Scenario: Review privileged function
- **WHEN** a future implementation proposes `SECURITY DEFINER`
- **THEN** the implementation SHALL include all required security controls and threat review before approval

### Requirement: Incremental delivery sections

Delivery SHALL proceed in this order, with each section implemented, validated, and certified before the next:

0. Architecture/OpenSpec; 1. `/inventory` visual shell; 2. scope and filters; 3. KPIs; 4. capital distribution; 5. operational health; 6. paginated operational table; 7. valuation CTA; 8. valuation shell and filters; 9. valuation KPIs; 10. valuation analytics; 11. valuation table; 12. document export; 13. responsive/accessibility; 14. global QA.

#### Scenario: Advance section
- **WHEN** a section is complete
- **THEN** its validation and certification evidence SHALL exist before the next section starts

### Requirement: Visual contract for later sections

Later visual sections SHALL use the approved corporate BI direction, responsive targets above 1440, 1280, 1024, 768, and 480, the existing icon library, Manus typography and design tokens, and flex/grid layouts without structural absolute positioning.

Later sections SHALL NOT use gradients, glassmorphism, pie charts, or heavy animations. Section 0 SHALL document this contract only and SHALL NOT implement visual components.

#### Scenario: Implement visual section
- **WHEN** a later section creates UI
- **THEN** it SHALL follow the approved visual and responsive constraints
