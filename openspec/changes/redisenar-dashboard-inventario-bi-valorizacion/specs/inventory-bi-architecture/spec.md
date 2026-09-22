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

### Requirement: Section 2 scope and filters

Section 2 SHALL replace the `Filtros de inventario` shell with functional primary controls for tenant, branch, product, category, and stock status, plus operational secondary context under `Más filtros`. It SHALL use one typed filter state containing `requestedTenantId`, `requestedBranchId`, `productIds`, `categoryId`, `stockStatus`, `terminalId`, `cashSessionId`, `startDate`, and `endDate`. An empty `productIds` SHALL mean all products. It SHALL not calculate BI metrics or trigger future BI queries.

#### Scenario: Role-aware controls
- **WHEN** an authenticated actor opens the Inventory BI filters
- **THEN** SUPER_ADMIN SHALL see tenant and branch selectors from the existing authorized dashboard options; SUPER_USER SHALL see its tenant as fixed context and branch options from the existing backend contract; ADMIN SHALL see tenant and assigned branch as fixed context

#### Scenario: Dependent scope
- **WHEN** tenant changes
- **THEN** branch, productIds, category, terminal, and cash selections SHALL clear and only options for the selected tenant response SHALL remain available

#### Scenario: Reset restricted scope
- **WHEN** the actor selects `Limpiar`
- **THEN** optional filters SHALL clear while authenticated tenant/branch defaults remain for restricted actors

#### Scenario: Stock status
- **WHEN** the actor selects stock status
- **THEN** the state SHALL support Todos, Con stock, Agotado, and Stock negativo; Stock bajo SHALL not be offered without a demonstrated minimum-stock rule

#### Scenario: Option failure
- **WHEN** an option source fails
- **THEN** the affected control SHALL expose an identifiable error and SHALL not silently present an empty successful state

#### Scenario: Authorized tenant category catalog
- **WHEN** SUPER_ADMIN selects an authorized tenant different from the authenticated tenant
- **THEN** the existing `/inventory/product-categories` read route SHALL accept the optional requested tenant, validate it server-side with the existing access-control contract, and return categories for that tenant

#### Scenario: Restricted category catalog
- **WHEN** ADMIN or SUPER_USER requests categories for a tenant outside its demonstrated scope
- **THEN** the backend SHALL reject the request and SHALL not return categories from the requested tenant

#### Scenario: Exhaustive product search with bounded results
- **WHEN** a user enters product text
- **THEN** `GET /inventory/products` SHALL apply parameterized, case-insensitive search over the authorized full scope before applying the optional `limit`; the response SHALL remain the existing product array shape and the UI SHALL request a bounded result set without downloading the complete catalog

#### Scenario: Product search backward compatibility
- **WHEN** existing consumers omit `search` and `limit`
- **THEN** `/inventory/products` SHALL preserve its current authorization, ordering, array response, and unbounded legacy behavior

#### Scenario: Product search scope
- **WHEN** a product search includes tenant, branch, search, or limit parameters
- **THEN** backend scope resolution SHALL run before product search, ADMIN and SUPER_USER SHALL remain restricted, and SUPER_ADMIN SHALL use only the requested tenant permitted by the existing Inventory scope contract

#### Scenario: Product multi-select
- **WHEN** the user selects multiple product results
- **THEN** the single Producto control SHALL retain every selected stable ID without duplicates, SHALL allow continued remote searching, SHALL show all selections with individual removal while open, and SHALL show only one or two compact names plus `+N` when closed

#### Scenario: Product selection contract for future BI
- **WHEN** a later BI section consumes the Section 2 filters
- **THEN** it SHALL apply `productIds` as a product ID `IN`/`ANY` constraint, and an empty array SHALL omit that product constraint

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

### Requirement: Section 3 first Inventory BI summary

Section 3 SHALL consume the demonstrated inventory sources: current stock from `stock_movements` as `IN - OUT` per active product and branch, and unit cost from `products.cost numeric(12,2) NOT NULL`. The base grain SHALL be one active product-branch row and SHALL preserve decimal and negative stock. Inventory cost SHALL be derived backend-side as `real_stock * real_unit_cost`.

#### Scenario: Contractual source of truth
- **WHEN** the summary is requested
- **THEN** it SHALL use stock movements and product cost, SHALL not use sale price or fabricated cost rules, and SHALL not double count through lot joins

#### Scenario: Stock classification
- **WHEN** a base row is classified
- **THEN** stock > 0 SHALL be `WITH_STOCK`, stock = 0 SHALL be `OUT_OF_STOCK`, and stock < 0 SHALL be `NEGATIVE`; `STOCK_LOW` SHALL remain unavailable without a demonstrated minimum-stock contract

### Requirement: Executive KPI summary

Section 3 SHALL expose an additive `/inventory/bi-summary` read contract with exactly five aggregate KPIs: `totalInventoryCost`, `totalInventoryUnits`, `productsWithStock`, `outOfStockProducts`, and `negativeStockProducts`. Cost and units SHALL be decimal strings; product counts SHALL be distinct `product_id` counts over the filtered product-branch base. The response SHALL not contain the complete product dataset.

#### Scenario: KPI consistency
- **WHEN** one scope and one applied filter set are queried
- **THEN** total cost SHALL equal the sum of `inventory_cost` in the filtered base and total units SHALL equal the sum of `real_stock`

#### Scenario: No fabricated sixth KPI
- **WHEN** the dashboard renders the executive cards
- **THEN** it SHALL render the five real KPIs and SHALL not invent Stock bajo, sales, cash, or another metric for the sixth shell position

### Requirement: Section 3 applied filters and scope

The summary SHALL consume authorized tenant/branch, `productIds`, category, and stock status from Section 2. Empty `productIds` SHALL omit the product constraint. Product IDs SHALL use parameterized `ANY`/`IN` semantics. Terminal, cash, and date context SHALL not alter current stock or valuation in Section 3. Backend scope enforcement SHALL remain authoritative for `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN`.

#### Scenario: Filtered summary
- **WHEN** product, category, branch, or status filters are applied
- **THEN** all five KPIs SHALL be computed from the same filtered dataset

### Requirement: Section 3 implementation boundary

Section 3 MAY use the repository's parameterized CTE/read-query convention and an additive endpoint. It SHALL not add a physical stored function, migration, index, materialized view, persistent cache, operational table, chart, valuation route, or export.

#### Scenario: Legacy compatibility
- **WHEN** Section 3 is deployed
- **THEN** legacy `/inventory/dashboard`, product/category consumers, route guards, child routes, and TenantLayout SHALL remain operational and unchanged in contract

### Requirement: Section 3 KPI numeric presentation

The KPI visual layer SHALL preserve decimal strings received from the backend and format them only for display. Inventory cost SHALL display `COP` with `es-CO` grouping and exactly two decimal places. Inventory units SHALL display `es-CO` grouping with up to two decimal places. Negative values SHALL retain their sign. Missing, invalid, loading, or failed values SHALL not be rendered as zero.

#### Scenario: Format financial and unit strings
- **WHEN** the backend returns `158831520.0000` for cost and `9926.97` for units
- **THEN** the UI SHALL show `COP 158.831.520,00` and `9.926,97` while preserving the raw strings in the data contract

#### Scenario: Preserve missing-value semantics
- **WHEN** a KPI value is missing or its request fails
- **THEN** the UI SHALL show its loading/error state and SHALL not show `COP 0,00` or `0` as a silent fallback

### Requirement: Product search focus continuity

The open Producto searchable multi-select SHALL keep the same search input mounted and enabled while the controlled search term changes, debounce executes, loading changes, and results, empty states, or errors update. Loading SHALL be communicated on the results region and SHALL not disable or replace the search input.

#### Scenario: Continuous product typing
- **WHEN** the user types consecutive characters in `Buscar producto`
- **THEN** the input SHALL retain focus while remote search is debounced and results are replaced, without requiring another click

#### Scenario: Product search loading or error
- **WHEN** product results are loading, empty, or failed
- **THEN** the dropdown SHALL remain open and the search input SHALL remain available for typing and correction

### Requirement: Section 4 shared BI base

Section 4 SHALL extract the certified product-branch semantics into one reusable `public.inventory_bi_base` read source before adding capital analytics. The source SHALL be a tabular `STABLE SECURITY INVOKER` read function, SHALL preserve active products and active branches, and SHALL derive `real_stock` from `stock_movements` as `IN - OUT`, `real_unit_cost` from `products.cost`, `inventory_cost` as `real_stock * real_unit_cost`, and status as positive/zero/negative without clamping. Backend scope resolution SHALL occur before the source is called.

#### Scenario: Summary regression gate
- **WHEN** `/inventory/bi-summary` is migrated to the shared source
- **THEN** all five Section 3 KPI values and decimal-string contracts SHALL remain unchanged for the certified scopes and filters

### Requirement: Section 4 capital distribution

Section 4 SHALL expose an additive typed `/inventory/bi-capital-distribution` read contract using the same applied tenant, branch, `productIds`, category, and stock-status filters as the summary. It SHALL return small aggregate datasets only: branch cost grouped by branch ID, category cost grouped by category ID, and at most five products grouped by product ID across included branches. Five is the executive dashboard maximum. Branch and category totals SHALL reconcile exactly with `totalInventoryCost` for the same snapshot. `category_id IS NULL` SHALL be returned as the user-facing `Sin categoría` bucket. Negative costs SHALL remain negative.

#### Scenario: Capital datasets
- **WHEN** an authorized user requests capital distribution
- **THEN** branch and category costs SHALL be ordered by descending cost, Top products SHALL be ordered by descending total cost, and no complete product dataset SHALL be returned

#### Scenario: Product participation
- **WHEN** a Top product is returned
- **THEN** participation SHALL use exact decimal semantics against the filtered total cost, and a zero denominator SHALL produce null rather than `NaN` or `Infinity`

### Requirement: Inventory BI visual contract

The Section 4 visual implementation SHALL establish the reusable Inventory BI visual contract for Sections 5-14: neutral page background, white surfaces, moderate existing radius, subtle border/shadow, approximately 20px section rhythm, compact 12-16px card gaps, dense readable spacing, and no gradients, glassmorphism, 3D decoration, or invented metrics. The contract SHALL use the existing container-query architecture with five balanced KPI cards in one wide row, symmetric 3+2 KPI distribution in intermediate content width, and progressive compact/mobile stacking. The filter surface SHALL remain compact without changing hit targets or draft/applied behavior. Capital charts SHALL retain bounded responsive heights, direct string-safe COP labels, accessible alternatives, and no body-level horizontal overflow. This contract SHALL be the default visual reference for later sections unless a later business requirement explicitly justifies an exception.

#### Scenario: Preserve real-data visual hierarchy

- **WHEN** the dashboard is rendered at wide, intermediate, or compact content width
- **THEN** it SHALL prioritize the five real KPIs, applied filter context, and capital distribution without adding unsupported trends, percentages, comparisons, or other mock-only metrics

### Requirement: Section 4 presentation and reconciliation

The web dashboard SHALL use the authorized Recharts dependency only for branch and category bar charts, and an accessible HTML ranking for Top products. Raw numeric strings SHALL remain authoritative; any finite, safe conversion SHALL be limited to chart geometry. Loading, error, and empty states SHALL remain local, and the charts SHALL preserve the approved container-query responsive layout without body overflow.

#### Scenario: Applied filter consistency
- **WHEN** the user applies filters or refreshes the dashboard
- **THEN** the KPI summary and all capital datasets SHALL be requested from the same applied filter set

#### Scenario: Accessibility alternative
- **WHEN** a chart is rendered
- **THEN** its heading, labels, and values SHALL also be available through accessible text or table content and SHALL not depend only on color or tooltip

### Requirement: Section 5.1 operational health discovery gate

Before implementing Section 5, the change SHALL classify each operational-health signal from demonstrated repository contracts. The shared `public.inventory_bi_base` SHALL remain the source for stock/cost-derived facts, and existing legacy dashboard, lot, and reconciliation contracts SHALL remain preserved until their scope and filter mapping is explicitly defined. Discovery SHALL NOT authorize production code, a new endpoint, migration, function, view, index, cache, or threshold.

The demonstrated current-state statuses are `WITH_STOCK`, `OUT_OF_STOCK`, and `NEGATIVE`. Existing summary counts are available but overlap Section 3. Negative units and negative inventory value MAY be derived later from the shared base with signed decimal semantics. `STOCK_LOW`, minimum-stock alerts, coverage, rotation, days-on-hand, and an overall health score SHALL remain unavailable or require a business rule until their exact formula, granularity, date behavior, and scope are approved. The existence of product `min_stock` fields alone SHALL not authorize a BI low-stock rule.

Pending purchase/order counts, lot expiration/status signals, and lot-reconciliation discrepancy/severity counts SHALL be treated as secondary operational contracts. Their existing status sets, date behavior, branch authorization, and filter semantics SHALL not be silently converted into current-state BI semantics. A future Section 5 response SHALL use applied Tenant, Branch, `productIds`, category, and stock-status filters and SHALL preserve backend-enforced scope; terminal, cash, and dates SHALL not affect current-state stock or cost.

#### Scenario: Safe health contract
- **WHEN** a Section 5 metric is proposed
- **THEN** it SHALL identify its source, aggregation, cardinality, filters, and whether it duplicates a Section 3 KPI before implementation

#### Scenario: No invented health classification
- **WHEN** the available signals are only descriptive counts or distributions
- **THEN** the UI SHALL not label them healthy, critical, high risk, or as a general health score without an approved business rule

#### Scenario: Insufficient independent indicators
- **WHEN** fewer than three independent health indicators are contractually ready
- **THEN** Section 5 SHALL reduce the card layout rather than display duplicated or fabricated metrics

#### Scenario: Shared source reuse
- **WHEN** a stock or inventory-cost health aggregate is implemented
- **THEN** it SHALL reuse `public.inventory_bi_base` and SHALL not duplicate the `stock_movements` IN-OUT plus `products.cost` formula

#### Scenario: API boundary
- **WHEN** Section 5 needs existing summary counts
- **THEN** it SHALL reuse `/inventory/bi-summary`; a specialized `/inventory/bi-operational-health` endpoint SHALL be introduced only for new, legitimate small aggregates whose cross-source scope contract has been approved

### Requirement: Section 5.2 operational health V1

Section 5.2 SHALL expose an additive typed `GET /inventory/bi-operational-health` contract under the existing `INVENTORY/READ` permission. It SHALL preserve legacy `/inventory/dashboard` and SHALL consume only applied authorized tenant, branch, `productIds`, category, and stock-status filters. Terminal, cash, and date context SHALL not affect current-state stock-derived values.

The V1 response SHALL include signed negative units derived from `public.inventory_bi_base`, distinct expired-lot count from `inventory_lots.status = 'EXPIRED'` intersected with the filtered product-branch base, and reconciliation counts from `InventoryLotReconciliationService` intersected with the same filtered product-branch keys. Existing discrepancy severity names MAY be returned as a breakdown, but no severity threshold or overall health score SHALL be invented. Pending purchase/order counts SHALL not be exposed as current-state BI unless their legacy date/terminal/cash semantics achieve explicit filter parity; the approved fallback is negative units.

The `/inventory` panel SHALL reuse the already loaded `/inventory/bi-summary` counts to present descriptive `WITH_STOCK`, `OUT_OF_STOCK`, and `NEGATIVE` counts and percentages. It SHALL not render a health score, healthy/critical/risk labels, trends, or low-stock values. `ProductEntity.minStock` and the legacy low-stock rule SHALL remain deferred until a branch-aware business rule is approved.

#### Scenario: Operational filter parity
- **WHEN** applied tenant, branch, product, category, or stock-status filters change
- **THEN** every operational-health aggregate SHALL be restricted to the same authorized filtered product-branch scope

#### Scenario: Safe pending fallback
- **WHEN** pending documents cannot satisfy current-state filter parity
- **THEN** the endpoint SHALL expose signed negative units as the fallback and SHALL not expose an unfiltered pending count

#### Scenario: Expired lot semantics
- **WHEN** a lot has status `EXPIRED`
- **THEN** it MAY count once by distinct lot ID only when its tenant, branch, and product intersect the filtered BI base

#### Scenario: Local operational failure
- **WHEN** the operational-health request fails
- **THEN** KPI and capital sections SHALL retain their own state and the health section SHALL show a localized error without fabricated zero values

#### Scenario: Operational health visual QA
- **WHEN** operational-health cards render zero or non-zero values
- **THEN** zero values SHALL use a neutral soft accent, non-zero values SHALL use the existing semantic accent, and labels/values SHALL remain visible without exposing internal fallback, parity, or enum names

### Requirement: Section 6 operational detail

The `/inventory` operational table SHALL consume `GET /inventory/bi-operational-page` with backend-enforced scope and the applied tenant, branch, product, category, and stock-status filters. The endpoint SHALL return only the requested page and `page`, `pageSize`, `total`, and `totalPages` metadata. It SHALL use the shared `public.inventory_bi_base` semantics and SHALL apply `COUNT` and page retrieval to the same filtered dataset.

#### Scenario: Request an operational page
- **WHEN** an authorized user requests page 2 with a bounded page size
- **THEN** the backend SHALL execute server-side pagination with deterministic ordering and SHALL not return rows outside that page

#### Scenario: Render operational columns
- **WHEN** the page contains rows
- **THEN** the table SHALL show Product, SKU, Category, Branch, Current stock, and Stock status, preserving negative stock and decimal-safe values

#### Scenario: Change applied filters
- **WHEN** applied scope or inventory filters change
- **THEN** the frontend SHALL request page 1 and the backend SHALL apply identical filters to `total` and `items`

#### Scenario: Narrow operational table
- **WHEN** the named Inventory BI content container is below 800px
- **THEN** the desktop table SHALL be hidden and the UI SHALL use an accessible labeled row representation without causing document horizontal overflow

### Requirement: Section 7 valuation entry

The Inventory dashboard SHALL expose an enabled `Ver valorización` CTA that navigates to `/{tenant}/inventory/valuation` using the current tenant route segment. The route SHALL use the existing TenantLayout and the existing `INVENTORY` read permission requirement. Section 7 SHALL not transfer dashboard filters or implement valuation data behavior.

#### Scenario: Navigate to valuation
- **WHEN** an authorized user activates `Ver valorización` from `/{tenant}/inventory`
- **THEN** the application SHALL navigate to exactly `/{tenant}/inventory/valuation`

#### Scenario: Open valuation directly
- **WHEN** an authorized user opens `/{tenant}/inventory/valuation` directly or refreshes it
- **THEN** the route SHALL render the valuation shell with tenant context and the standard TenantLayout

#### Scenario: Valuation shell boundary
- **WHEN** the Section 7 valuation shell renders
- **THEN** it SHALL show only structural future-work surfaces and SHALL not show fabricated metrics, filters with business behavior, analytics, detail data, pagination, or export controls

### Requirement: Section 8 valuation filters

The valuation route SHALL own an independent draft/applied filter state containing only authorized tenant, branch, product IDs, category ID, and stock status. It SHALL reuse the certified scope and catalog contracts, SHALL apply `productIds=[]` as no product filter, and SHALL exclude terminal, cash, and date context from current-state valuation. Section 8 SHALL not request valuation KPIs, analytics, detail rows, or exports.

#### Scenario: Apply valuation filters
- **WHEN** an authorized user changes Tenant, Sucursal, Producto, Categoría, or Estado de stock and activates `Aplicar filtros`
- **THEN** the route SHALL expose the applied filter snapshot for later valuation sections without inheriting dashboard filters or making a valuation data request in Section 8

#### Scenario: Preserve authorized scope
- **WHEN** tenant or branch changes
- **THEN** the filter state SHALL clear incompatible branch, product, and category selections and SHALL preserve the backend-enforced role scope; frontend controls SHALL not grant cross-tenant or cross-branch authority

#### Scenario: Remote product selection
- **WHEN** the user searches Producto
- **THEN** the UI SHALL reuse server-side `/inventory/products` search with debounce and a bounded result set, preserve focus while loading/results change, store stable `productIds` without duplicates, and allow individual removal

#### Scenario: Reset valuation filters
- **WHEN** the user activates `Limpiar`
- **THEN** optional product/category/status selections SHALL clear while required tenant/branch scope SHALL remain intact, and `productIds` SHALL become an empty array

### Requirement: Section 9 valuation KPIs

The valuation summary SHALL show only the real current-state KPIs defined for Section 9: total valued cost and valued units. It SHALL consume the applied Section 8 filters through the existing `/inventory/bi-summary` contract and certified `public.inventory_bi_base`; it SHALL not duplicate stock movement or cost formulas and SHALL not request analytics, detail rows, or exports.

#### Scenario: Reconcile valuation KPIs
- **WHEN** an applied valuation filter snapshot is queried
- **THEN** total valued cost SHALL equal `SUM(inventory_cost)` and valued units SHALL equal `SUM(real_stock)` over the same filtered product-branch rows

#### Scenario: Preserve valuation numeric semantics
- **WHEN** the base returns decimal or negative values
- **THEN** the API SHALL preserve numeric strings, the UI SHALL format them with the certified string-safe formatters, and negative values SHALL not be clamped or recalculated in the frontend

#### Scenario: Handle valuation summary states
- **WHEN** the summary is loading, unavailable, or valid with zero values
- **THEN** the summary SHALL preserve its skeleton/error state, show `No disponible` for unavailable values, and show zero for valid zero results without silently converting errors to zero

### Requirement: Section 10 valuation analytics

The valuation analytics SHALL reuse the certified capital-distribution and summary contracts with the applied Section 8 filters. It SHALL show branch cost, category cost, bounded product ranking, and descriptive stock-status distribution without adding economic formulas, historical trends, health scores, or a complete detail dataset.

#### Scenario: Reconcile analytics with valuation total
- **WHEN** analytics and summary are requested for the same applied scope and filters
- **THEN** the sum of branch costs and the sum of category costs SHALL equal the valuation total cost, null categories SHALL remain in `Sin categoría`, and product ranking SHALL remain grouped by `product_id`

#### Scenario: Render bounded analytics accessibly
- **WHEN** branch/category analytics have data
- **THEN** the UI SHALL render the existing Recharts bar pattern with direct safe currency labels and tooltips, while Top products and status distribution SHALL expose textual values independently of color or tooltip

#### Scenario: Render compact valuation product ranking
- **WHEN** the valuation Top 5 has product rows
- **THEN** each row SHALL show a real product thumbnail or initials fallback, an accessible controlled product name, string-safe cost, and participation without clipping; row height SHALL remain content-driven and the neighboring status panel SHALL not be artificially stretched

#### Scenario: Preserve analytics states
- **WHEN** analytics are loading, unavailable, or empty for valid filters
- **THEN** the analytics area SHALL show localized skeleton/error/empty states without fake bars, zero substitution for errors, horizontal document overflow, or disruption of filters and valuation KPIs

### Requirement: Section 11 valuation detail

The valuation route SHALL expose a typed, backend-paginated detail dataset through `GET /inventory/bi-valuation-page`. It SHALL reuse `public.inventory_bi_base`, backend-enforced `INVENTORY/READ` scope, and applied tenant, branch, product IDs, category, and stock-status filters. `productIds=[]` SHALL mean no product restriction; terminal, cash, and date filters SHALL be excluded.

#### Scenario: Request a valuation detail page
- **WHEN** an authorized user requests a page with a bounded page size
- **THEN** the backend SHALL execute a matching filtered `COUNT(*)` and `LIMIT/OFFSET` query and return only that page with `page`, `pageSize`, `total`, and `totalPages`

#### Scenario: Preserve valuation row semantics
- **WHEN** the page contains rows
- **THEN** each row SHALL represent one active product-branch record and expose product, SKU, category, branch, real stock, real unit cost, inventory cost, participation, and stock status using decimal-safe values

#### Scenario: Calculate participation over the full set
- **WHEN** a filtered detail page is requested
- **THEN** participation SHALL use the complete filtered inventory cost total, not the visible page; zero total cost SHALL produce null and negative values SHALL remain signed

#### Scenario: Render valuation detail responsively
- **WHEN** the usable BI container is compact
- **THEN** the table SHALL switch to labeled accessible cards without document horizontal overflow, while desktop/intermediate containers SHALL retain semantic table headers and accessible pagination
