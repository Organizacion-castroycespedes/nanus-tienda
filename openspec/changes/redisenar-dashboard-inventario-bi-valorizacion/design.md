## Context

The repository currently renders `/{tenant}/inventory` as the principal inventory dashboard through `web/app/[tenant]/inventory/page.tsx` and `web/modules/inventory/components/InventoryDashboard.tsx`. The dashboard already has role-aware scope filters, KPIs, lot alerts, reconciliation, charts, operational lists, and links to Inventory child routes. Existing child routes must remain operational.

Section 0 is an architecture decision record. It prepares a later incremental implementation of an Inventory BI Dashboard and a specialized current inventory valuation view. It does not authorize production code, physical SQL functions, migrations, route registration, visual implementation, staging, commit, or push.

## Goals / Non-Goals

**Goals:**

- Make `/{tenant}/inventory` the future BI experience, with no parallel dashboard.
- Preserve the route guard, current scope behavior, current capabilities, and all Inventory child routes.
- Establish one conceptual base dataset for tenant, branch, product, category when present, real stock, unit cost, inventory cost, and stock status.
- Define backend-enforced role scope and the contractual stock-cost formula.
- Define summary, server-side pagination, valuation, consistency, and export contracts.
- Define an incremental delivery plan where each section can be implemented and certified independently.

**Non-Goals:**

- No React, NestJS, backend-reporteria, API, SQL, migration, menu, permission, or stored-function implementation.
- No physical names for future SQL functions.
- No materialized views, summary tables, persistent cache, or new indexes.
- No final visual design implementation.
- No historical valuation. Valuation is current inventory only.
- No PDF/XLSX generation in Section 0.

## Decisions

### Section 1 visual shell implementation

Section 1 replaces the rendered root presentation in `web/app/[tenant]/inventory/page.tsx` with `InventoryBiDashboard` from `web/modules/inventory/components/InventoryBiDashboard.tsx`. The exact shell hierarchy is:

```text
main.InventoryBiDashboard
├── header.InventoryBiHeader
├── ScopeFiltersShell
├── KpiShell (6 skeleton cards)
├── CapitalDistributionShell
│   ├── Distribución del capital group heading
│   ├── Costo por sucursal
│   ├── Costo por categoría
│   └── Top productos
├── OperationalHealthShell
│   ├── Salud operativa group heading
│   ├── 3 compact health cards
│   └── Estado del inventario
├── InventoryValuationCtaShell (disabled in Section 1)
└── OperationalTableShell
```

The shell uses existing `Button` and `lucide-react` icons. It maps existing tenant theme variables instead of introducing a new palette: `--brand-background` for the page surface, `--brand-surface-card` for panels, `--brand-surface-text` for primary text, `--brand-surface-muted` for secondary text, `--brand-surface-border` for borders, and `--brand-primary-*` for the valuation CTA emphasis. The Header is intentionally plain on the page background; cards begin after the Header. The only local visual primitive is a small `InventoryBiSkeleton`, because no shared Skeleton component exists in the repository.

The responsive foundation uses the repository's Tailwind defaults (`sm`, `md`, `lg`) for approved intermediate and compact layouts. The Inventory BI main element is also a named inline-size container; the five-card KPI row activates at 1200px of usable content width because the TenantLayout sidebar and page padding reduce the physical viewport width. The WIDE rule explicitly resets the intermediate `:nth-child(n + 4)` spans, so cards 4 and 5 reflow into the same five-column row after sidebar expansion or collapse without JavaScript. At 1280px, the wider capital panels (4/4/4) and health row (6/6) also activate. This avoids treating monitor viewport width as available width after the sidebar. The page is full width with responsive padding, 16px section gaps, no structural absolute positioning, and no body-level horizontal overflow. KPI cards retain a 160px minimum width. The long formatted currency and units KPIs use container-relative responsive typography and remain complete, non-truncated values. Capital and health groups have their own visible headings above the existing grids.

Loading is represented by stable structural skeletons with `aria-busy` on the dashboard and no fabricated metrics. The component exposes `viewState="error"` and an optional retry callback for the later data integration; the error copy is exactly `No fue posible cargar el Dashboard de Inventario.` The refresh button accepts an optional existing refresh callback and remains disabled in this shell because Section 1 does not alter the current data contract. The valuation CTA is disabled and does not navigate because its route is not implemented yet.

### Section 2 scope and filters implementation

Section 2 replaces the filter skeleton with `InventoryBiFiltersPanel`. It owns one typed `InventoryBiFilters` state containing requested tenant/branch, `productIds`, category, stock status, and secondary terminal/cash/date context. An empty `productIds` array means all products. The single user-facing Producto control is a searchable multi-select: each remote result toggles one stable product ID without duplicates, the closed control keeps compact density, and the open control shows every selected item with individual removal. Apply is explicit; changing tenant or branch clears product selections that no longer belong to the new scope, along with dependent operational context. Reset returns to the authenticated tenant/branch defaults and sets `productIds` to `[]` without widening restricted scope.

The panel reuses the existing `/inventory/dashboard`, `/inventory/products`, and `/inventory/product-categories` contracts for options. The demonstrated backend behavior is: `SUPER_ADMIN` can request global tenants and active branches; `SUPER_USER` is tenant-fixed and the current backend grants all active branches in that tenant; `ADMIN` is tenant/branch constrained by membership and the dashboard exposes branch as fixed context. Frontend controls do not authorize requests. The category route accepts an optional `tenantId` for this read use-case and validates it with the existing `AccessControlService`; only `SUPER_ADMIN` may widen the tenant, while restricted actors remain tenant-bound. The existing `/inventory/products` route now accepts optional `search` and `limit` parameters while preserving its array response and legacy behavior when omitted. Search is parameterized SQL over demonstrated `products.name` and `products.sku`, applied to the authorized tenant/branch scope before the defensive server maximum of 25 rows. The filter waits for product text, debounces 300 ms, requests `limit=25`, and invalidates stale tenant/branch results. No catalog-wide client download remains.

Primary filters are Tenant, Sucursal, Producto, Categoría, and Estado de stock. The demonstrated stock fields support `all`, `in_stock`, `out_of_stock`, and `negative`; `Stock bajo` is intentionally omitted because the repository does not demonstrate the exact minimum-stock calculation used by the legacy dashboard function. Terminal, Caja, Fecha inicial, and Fecha final remain under `Más filtros` as operational context for future secondary consumers and do not trigger BI calculations in Section 2.

Section 2 role and visual QA are accepted. The specific check of the open Producto multi-select on mobile is intentionally deferred to Section 13 responsive/accessibility QA and is not a Section 2 blocker. A minor follow-up may make the closed compact summary's `+N` indicator more explicit when more than two selections exist; the multi-select contract itself is complete.

The previous `InventoryDashboard.tsx`, its operational consumers, child routes, and `TenantLayout` remain preserved. Section 2 only adds backward-compatible optional read parameters to existing category and Inventory product routes; no response shape, BI endpoint, or authorization architecture is replaced. This preserves the operational implementation for later re-homing and avoids deleting current capabilities.

### Section 3 first BI read model and executive KPIs

Discovery confirms the contractual inventory source. Current stock is the active-branch, product-level aggregation of `stock_movements.quantity`, adding `IN` movements and subtracting `OUT` movements. `products.cost` is `numeric(12,2) NOT NULL`, is the existing product-level unit cost used by `getInventoryCostTotal`, and is not sale price or a newly invented average/FIFO/LIFO cost. The BI base grain is one row per active `product_id` x `branch_id`; this avoids lot/location double counting because no separate lot balance is joined. Decimal stock, zero stock, and negative stock are preserved.

Section 3 implements the first read model as a parameterized repository CTE rather than a physical SQL function or migration, matching the repository's current direct-query convention. The endpoint is the additive `GET /inventory/bi-summary`; legacy `GET /inventory/dashboard` remains untouched. The CTE normalizes `tenant_id`, `branch_id`, `product_id`, `category_id`, `real_stock`, `real_unit_cost`, `inventory_cost = real_stock * real_unit_cost`, and `stock_status`. It returns only small summary aggregates, never a complete product dataset.

The summary consumes the applied Section 2 filters: authorized tenant/branch, `productIds` with empty array meaning no product restriction, category, and stock status. Terminal, cash, and date context are not sent because they do not alter current stock. Status is `WITH_STOCK` for stock > 0, `OUT_OF_STOCK` for stock = 0, and `NEGATIVE` for stock < 0. `STOCK_LOW` remains a documented gap because no contractual minimum-stock rule was demonstrated.

The five real KPI cards are total inventory cost, total inventory units, products with stock, out-of-stock products, and negative-stock products. Cost and units are returned as decimal strings to avoid JavaScript precision loss. Product counts use `COUNT(DISTINCT product_id)` over the filtered product-branch base. All KPIs use the same applied filters. The previous six-card shell is reduced to five real cards; no sixth metric is fabricated and no Stock bajo KPI is introduced. Frontend only renders backend values and does not recalculate cost.

The service reuses the Section 2 scope resolver and accessible-branch lookup. Requested tenant and branch are backend-enforced; frontend IDs are not authorization. Product IDs use a parameterized PostgreSQL `ANY($n::uuid[])` constraint. The legacy dashboard and product/category consumers retain their contracts. No index, cache, materialized view, stored function, or migration is added. EXPLAIN evidence is a pending manual data/performance QA item because no safe representative database execution was available in this implementation.

KPI presentation keeps the backend decimal-string contract unchanged. The Inventory visual layer uses a local string-safe formatter because the shared finance formatter accepts `number` and would risk precision loss for PostgreSQL `numeric` values. Money displays `COP` with `es-CO` thousands separators and exactly two decimals; units display `es-CO` separators with up to two decimals. Missing or invalid values remain unavailable and are never replaced with zero.

The Product searchable multi-select keeps its search input mounted and enabled for the whole open-dropdown lifecycle. Loading is exposed on the results list with `aria-busy`; it does not disable or replace the input. This preserves focus while the controlled search term changes, the 300 ms debounce runs, and result/error/empty states update. No backend contract or selection behavior changes.

### Section 4 capital distribution implementation

Section 4 extracts the certified product-branch semantics into the physical tabular function `public.inventory_bi_base`, added by `V091__inventory_bi_base_read_model.sql`. The function is `LANGUAGE sql STABLE SECURITY INVOKER`; it does not resolve actor permissions. `InventoryService` continues resolving tenant and branch access through the existing `AccessControlService`/finance access path before invoking it. The function preserves active products and active branches, computes stock as `SUM(IN) - SUM(OUT)`, uses `products.cost` as unit cost, derives inventory cost in PostgreSQL, and classifies positive, zero, and negative rows without clamping.

`GET /inventory/bi-summary` now aggregates the shared function, which is the Section 3 regression gate. `GET /inventory/bi-capital-distribution` is additive and returns three bounded outputs: branch distribution, category distribution, and Top 5 products. Five is the executive dashboard maximum. Branch and category rows are grouped by IDs, include tenant identity, preserve negative costs, and serialize numeric values as strings. Null categories are returned as `Sin categoría`. Top products aggregate all included branches by `product_id`; participation is numeric-safe and null when the filtered denominator is zero. Terminal, cash, and date context do not participate.

The web uses the explicitly authorized `recharts@2.15.4`, compatible with the existing React 18 and Next 14 versions without changing core versions or using peer-dependency bypass flags. Recharts is used only for branch/category bar charts. Top products remains an accessible HTML ranking. Raw API decimal strings remain authoritative; safe finite numbers are derived only for Recharts geometry and never for reconciliation or API values. The existing string-safe COP/unit formatter is reused.

Section 4 validation covers repository/service regression tests, capital aggregation shape and mapping, API build, Web lint/build, and OpenSpec validation. Read-only database reconciliation and EXPLAIN evidence must confirm branch/category sums against the Section 3 KPI for representative scopes before Section 4 is manually certified. Manual visual QA remains pending. If the QA database does not yet contain `public.inventory_bi_base`, migration application is a schema prerequisite and must not be represented as read-only evidence.

### Section 4 read-only QA evidence

The configured `manus_tienda_qa` connection was checked without exposing `scripts/config/db.env`; database was `manus_tienda_qa`, user was `manus_user`, and `public.inventory_bi_base(uuid,uuid[],uuid[],uuid,text)` was absent before the authorized apply. `V091__inventory_bi_base_read_model.sql` was then applied exclusively to this QA database through `apply_single_migration.sh`; no other migration was selected. The function is `LANGUAGE sql`, volatility `STABLE`, `SECURITY INVOKER`, owned by the database owner, and the migration history records success. The migration contains no business-data DML, destructive DDL, indexes, cache, or materialized view. Independent read-only SQL over the demonstrated source tables and the physical function confirmed the Section 3 unfiltered reference for sanitized tenant `T1`: 77 product-branch rows, `totalInventoryCost=3037406835.0000`, and `totalInventoryUnits=45986.97`. One active branch carried `3037406835.0000`; category totals were `2844240315.0000`, `158831520.0000` for C2, and `34335000.0000` for the null-category bucket. The executive ranking is capped at five rows and has no duplicate product IDs; the leading values were `2174710000.0000`, `622626200.0000`, and `158831520.0000`.

The physical function plans were `ACCEPTABLE` for the small QA dataset. Summary execution was `1.434 ms` with planning `4.695 ms` and 26 shared hits; branch aggregation was `0.651 ms` with planning `1.214 ms` and 23 shared hits; category aggregation was `0.642 ms` with planning `1.162 ms` and 23 shared hits; Top 5 was `2.309 ms` with planning `7.280 ms` and 29 shared hits. Plans used the existing active-branch/category indexes and tenant-filtered scans; `stock_movements` used a sequential scan of 370 rows. The additional function overhead is small on this QA dataset, but production-scale representativeness remains limited and no optimization is claimed. `DB SCHEMA MODIFIED: YES, QA ONLY`; `DB BUSINESS DATA MODIFIED: NO`; `DB.ENV MODIFIED: NO`; `PRODUCTION MODIFIED: NO`.

### Section 4 visual QA corrections

The visual QA overflow came from the Top products table imposing `min-width: 520px` inside the wide 4-column card, combined with grid children retaining automatic minimum content width. The fix uses `min-w-0` on BI panels and capital grid children, removes the table minimum width and internal horizontal scroller, and uses a fixed-layout table. In the wide 4-column variant SKU is secondary and hidden; rank, product, cost, and participation remain visible. The 12-column/intermediate table keeps all five columns. Product names keep truncation with `title` and `aria-label`. Each product row now places a compact thumbnail before the name using the existing product-image route, with product initials as the fallback when no image exists; the capital API contract remains unchanged.

Branch and category chart height now derives from row count and is bounded between 112px and 260px, preventing a one-branch chart from creating excessive empty space. Recharts `LabelList` renders direct COP values from raw decimal strings through the existing string-safe formatter. Tooltip content also reads raw values and formats them as COP, without scientific notation or raw decimals. Extra right chart margin reserves label space. Empty and error states remain text-only and do not create fake bars.

Top product cost and participation cells reserve stable column widths and use non-breaking text, so formatted COP amounts remain on one line while the product column remains the flexible/truncating column.

The approved Inventory BI visual contract now applies to Sections 5-14: neutral background with white surfaces, moderate radius, subtle border/shadow, 20px section rhythm, compact 12-16px card gaps, dense but readable spacing, and no gradients, glassmorphism, 3D decoration, or invented metrics. The wide content-container mode uses five balanced KPI cards in one row; the intermediate mode uses a symmetric 3+2 KPI arrangement; compact modes progressively stack. The filter surface remains compact while preserving all hit targets and draft/applied behavior. Existing Recharts views keep their bounded heights, direct string-safe COP labels, accessible alternatives, and no body overflow. The local BI chart color maps the existing Manus default primary token, while tenant branding remains unchanged outside BI visuals.

### Section 5.1 operational health discovery and contract gate

Section 5 discovery confirms that the current `OperationalHealthShell` is visual-only. It reserves three compact cards and an `Estado del inventario` panel, but it does not establish operational metrics. No production code, endpoint, migration, query, threshold, or visual change is authorized by this discovery gate.

The certified `public.inventory_bi_base` is sufficient for descriptive current-state signals: one active product x active branch row, `real_stock`, `inventory_cost`, and `stock_status` (`WITH_STOCK`, `OUT_OF_STOCK`, `NEGATIVE`). The existing `/inventory/bi-summary` already exposes distinct product counts for the three states. These facts are reusable, but displaying the same counts as new health cards would duplicate Section 3 without adding operational meaning. A future health panel may instead show the state distribution and, only after an additive aggregate contract, negative units and negative inventory value as impact measures. Negative values must remain signed.

The repository also contains real legacy operational sources that must be preserved and reviewed before relocation: `inventory_dashboard_snapshot` exposes pending purchases, pending orders, critical products, recent movements, and legacy low-stock behavior; product contracts contain `min_stock` and `max_stock`; inventory lots contain expiration dates and statuses; and `InventoryLotReconciliationService` exposes discrepancy counts and severities for real lot/movement inconsistencies. These sources are not interchangeable with the BI base. Pending documents use operational snapshot semantics, and lot reconciliation has its own branch/product/date filters. Section 5 must first define how those contracts map to the applied Tenant/Sucursal/Producto/Categoría/Estado filters and backend authorization before aggregating them into one health response.

The legacy low-stock rule is demonstrable only in the legacy snapshot: positive stock, outbound activity in the requested period, and `stock <= outbound_in_period`. It is date/context-dependent and is not a current-state minimum-stock rule. Although products have `min_stock`, the BI base does not carry it and the repository does not demonstrate a branch-aware comparison contract. Therefore `STOCK_LOW`, coverage, rotation, days-on-hand, and a general health score remain business-rule gaps. No labels such as `crítico`, `saludable`, or `riesgo alto` may be introduced without an explicit rule.

#### Section 5.1 classification

| Signal | Classification | Evidence and boundary |
|---|---|---|
| Products with stock / out of stock / negative products | AVAILABLE NOW | Section 3 summary and `inventory_bi_base`; distinct `product_id` counts over the applied product-branch dataset. Reuse, do not duplicate blindly. |
| Negative units | DERIVABLE SAFELY | `SUM(real_stock) FILTER (WHERE real_stock < 0)` over the shared base; not currently exposed by the summary. |
| Negative inventory value | DERIVABLE SAFELY | `SUM(inventory_cost) FILTER (WHERE real_stock < 0)` over the shared base; preserve sign and decimal strings. |
| Stock low / minimum stock | REQUIRES BUSINESS RULE | `ProductEntity` has `minStock`, but no approved branch-aware current-state rule is present in the BI base or summary. |
| Coverage, rotation, days-on-hand | REQUIRES BUSINESS RULE | Would require a defined demand/time window. Legacy outbound activity cannot silently become current-state BI semantics. |
| Pending purchases and orders | AVAILABLE NOW | Existing `inventory_dashboard_snapshot` counts with legacy document statuses; preserve as secondary operational context and map scope before reuse. |
| Lot expiration and lot alerts | AVAILABLE NOW | `InventoryLotEntity` has expiration/status and lot routes exist; aggregate health count still needs applied-filter and scope mapping. |
| Reconciliation/discrepancies | AVAILABLE NOW | `InventoryLotReconciliationService` returns discrepancy and severity counts with real discrepancy types; it is a separate contract, not a base-model field. |
| BI reconciliation impact from the base | NOT AVAILABLE | No single current endpoint exposes base reconciliation/discrepancy aggregates with the full Section 2 filter contract. |
| Overall health score, healthy/critical status, risk percentage | NOT AVAILABLE | No demonstrated business rule authorizes evaluative classification. |

#### Recommended Section 5 V1 contract

The minimum safe V1 is descriptive and may use fewer than three cards if the final contracts do not provide three independent signals:

1. `Documentos pendientes`: preserve separate `pendingPurchases` and `pendingOrders` counts from the legacy snapshot. This adds operational workload context and does not enter the economic read model. It requires explicit mapping of applied scope and the legacy status sets.
2. `Impacto de stock negativo`: use negative product count already available plus future `negativeUnits` and `negativeInventoryCost` aggregates from `inventory_bi_base`. The product count overlaps Section 3, while units and value explain operational magnitude. No severity label is implied.
3. `Excepciones de lotes y reconciliación`: reuse the existing reconciliation summary (`discrepancyCount`, `criticalCount`, `highCount`, `warningCount`, `infoCount`) and expiration-related discrepancy types only after its branch/scope/filter mapping is approved. Existing severity is discrepancy-type metadata, not an overall inventory health score.
4. `Estado del inventario`: a descriptive distribution of `WITH_STOCK`, `OUT_OF_STOCK`, and `NEGATIVE` from the shared base. It adds a relationship view over the executive counts and must not call any state healthy or critical.

All future Section 5 reads SHALL use the applied Tenant, Branch, `productIds`, category, and stock status filters, with AccessControlService remaining authoritative. Terminal, cash, and dates SHALL not alter current-state base stock; if pending documents or reconciliation require operational dates, that dependency must be explicit and remain secondary. `inventory_bi_base` remains the only source for stock/cost-derived health facts. No new function, view, index, cache, or materialized view is part of discovery.

The API decision is to reuse `/inventory/bi-summary` for its existing counts and avoid a redundant request. Do not overload `/inventory/bi-summary` with legacy documents or lot facts. If the V1 needs a combined response after scope mapping is specified, implement a specialized `GET /inventory/bi-operational-health` with small typed aggregates; otherwise keep the existing contracts separate. This is a proposal only, not an endpoint authorization.

The visual contract is inherited from Section 4: same neutral background, white surfaces, moderate radius, compact spacing, existing icons/tokens, and container-query modes. Wide may show up to three compact descriptive indicators plus the state panel; intermediate reflows cards and puts the state panel below; compact/mobile stacks progressively. If fewer than three independent indicators are contractually ready, the layout SHALL reduce rather than render duplicate or fabricated cards. Color may describe positive, warning, or negative data, but never be the sole accessibility signal or an invented health classification.

### Section 5.2 operational health V1 implementation

Section 5.1 is complete as discovery and contract approval. Section 5.2 implements the additive `GET /inventory/bi-operational-health` endpoint without changing legacy `/inventory/dashboard`, the Section 3 summary, or the Section 4 capital contract. Backend scope continues through the existing `InventoryService` product-filter resolver and accessible-branch lookup. The endpoint accepts the applied tenant, branch, `productIds`, category, and stock-status filters; terminal, cash, and dates are not sent.

The pending-operations gate selected the authorized fallback `Unidades en stock negativo`. The legacy pending purchase/order values come from `inventory_dashboard_snapshot` and depend on operational date, terminal, cash, and legacy status semantics. They cannot currently satisfy current-state BI filter parity, so no misleading pending count is exposed. The fallback is calculated from `public.inventory_bi_base` as signed `SUM(real_stock) FILTER (WHERE real_stock < 0)` and also returns signed negative inventory cost for future use. This is descriptive impact, not a risk or health score.

The endpoint also returns `expiredLotCount`, counting distinct `inventory_lots.id` where the demonstrated domain status is `EXPIRED`, intersected with the filtered product-branch rows from `public.inventory_bi_base`. It returns reconciliation counts from `InventoryLotReconciliationService`; discrepancy records are intersected with the same filtered product-branch keys before counting, and the existing service severity names (`CRITICAL`, `HIGH`, `WARNING`, `INFO`) are retained as a breakdown only. No new severity or threshold is introduced. Records without a product/branch intersection are excluded from the filtered health result.

The dashboard keeps `/inventory/bi-summary` as the source for the `Estado actual del stock` panel. It renders `WITH_STOCK`, `OUT_OF_STOCK`, and `NEGATIVE` counts with descriptive percentages over their total. Zero is a real count; empty or failed data is not silently converted to zero. The three compact cards are `Unidades en stock negativo`, `Discrepancias de conciliación`, and `Lotes vencidos`. The stock panel is not a score and does not label states healthy, critical, or risky.

The frontend inherits the Section 4 visual contract, uses existing tokens and icons, preserves container-query layout, and keeps operational errors local through `Promise.allSettled`. Section 5.2 automated QA, read-only QA, and manual visual QA are PASS. No migration, view, function, index, cache, materialized view, Section 6 table, or low-stock rule is added.

Operational-health copy is user-facing: negative units describe the signed quantity, expired lots describe currently registered expired lots, and internal fallback/parity/status names are not shown. A zero value uses a neutral soft accent; a non-zero value keeps the existing semantic warning/danger accent. Labels and values remain visible, so color is not the only state signal.

Section 5.2 QA evidence is recorded against the observed QA dataset without hardcoding values: `Unidades en stock negativo = 0` with neutral accent; `Discrepancias de conciliación = 31`, including `0` critical and `31` high with warning accent; `Lotes vencidos = 0` with neutral accent; and stock distribution `Con stock = 18 (23.4%)`, `Agotados = 59 (76.6%)`, `Negativo = 0 (0.0%)`. These are evidence values only. The read-only database evidence remains 77 base rows, 18 with stock, 59 out of stock, 0 negative, 0 expired lots, and EXPLAIN `0.977 ms` with 26 shared hits; no business data was fabricated or modified. Category QA had no matching category in the selected scope.

### Section 3.3 manual data QA evidence

Section 3.3 passed against the read-only `manus_tienda_qa` database configured by `scripts/config/db.env`. The QA scope was sanitized as tenant `T1`, with one active branch, 77 active product-branch rows, 18 positive rows, 59 zero rows, and no negative rows. The independent reconciliation used `SUM(quantity) FILTER (WHERE type = 'IN') - SUM(quantity) FILTER (WHERE type = 'OUT')`, joined active products to active branches, and calculated cost from `products.cost`; it was not copied from the repository SQL string. All commands ran inside `BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;` and no data was modified.

For the real category filter `C2` (four product-branch rows), the independent SQL and the executed repository summary query returned exactly: `totalInventoryCost = 158831520.0000`, `totalInventoryUnits = 9926.97`, `productsWithStock = 1`, `outOfStockProducts = 3`, `negativeStockProducts = 0`. The unfiltered scope returned `3037406835.0000`, `45986.97`, `18`, `59`, `0`. Product filter with one selected product and with two selected products returned zero units/cost and one/two out-of-stock products respectively. The category filter returned the C2 values above. `WITH_STOCK` returned `45986.97`, `3037406835.0000`, `18`, `0`, `0`; `OUT_OF_STOCK` returned `0.00`, `0.0000`, `0`, `59`, `0`; `NEGATIVE` returned zeros because no negative rows exist. Empty `productIds` matched the unfiltered result. Terminal, cash, and date fields were not included because current-state KPI semantics do not consume them.

Cardinality is explicit and confirmed structurally and by the real scope: the base grain is product x branch, while each health KPI is `COUNT(DISTINCT product_id)` after status filtering. The QA database has one active branch per tenant, so cross-branch duplicate behavior was not observable without fabricating data; the SQL contract remains distinct product identity, not product-branch row count. Negative-stock data was not present; automated classification coverage remains the evidence for that branch.

The authenticated HTTP endpoint was not invoked because no session token was automated; the exact repository summary SQL was executed directly with the same tenant/category/status parameters, and service mapping plus scope enforcement remain covered by focused automated tests. Raw numeric values matched before frontend formatting; the formatter was not used in reconciliation. The read model is REUSABLE for Sections 4/6/valuation at the semantic level, with a DUPLICATION RISK because the current CTE is not yet a physical shared function/view; extraction should be considered before Section 4 duplicates it.

`EXPLAIN (ANALYZE, BUFFERS)` on the exact summary query for T1 + C2 reported planning time `2.239 ms`, execution time `0.564 ms`, 20 shared buffer hits, actual 4 base rows, and 1 aggregate row. It used `idx_products_tenant_category_subcategory` for products and `idx_tenant_branches_estado` for branches; `stock_movements` used a tenant-filtered sequential scan of 370 rows. The plan is ACCEPTABLE for this small QA dataset, but production representativeness is limited; future optimization requires production-scale evidence. No index, cache, materialized view, SQL, or code change was made for performance.

### Route replacement

The existing `/{tenant}/inventory` route remains the main route and will later render the new Inventory BI Dashboard. The implementation must replace the existing experience in place. It must not create a second dashboard route. The existing route permission and all child routes remain available.

The future valuation route is recommended as `/{tenant}/inventory/valuation`. This is an architectural target only. Route permission and menu registration are deferred to implementation.

### Shared read model

Use one conceptual `inventory_bi_base` semantic dataset for all BI and valuation consumers. It normalizes authorized scope, product identity, category when available, real stock, real unit cost, inventory cost, and stock status. It is a dataset contract, not a physical SQL name.

The base model must not return a complete JSONB document, paginate, or contain dashboard-specific KPIs and charts. Small aggregates may be produced by specialized consumers over this base model.

### Conceptual database flow

```text
inventory_scope
        |
        v
inventory_bi_base
   |        |          |             |
   v        v          v             v
summary  products_page valuation_count valuation_batch
```

These names are conceptual. They do not authorize physical functions. Final names must follow repository SQL conventions when implementation begins.

### Economic source of truth

Stock and cost must use only contractual sources demonstrated by discovery. `stockTotal` is a quantity. Economic value is calculated backend-side with the equivalent contractual formula:

```text
inventory_value = real_stock * real_unit_cost
```

The frontend must never recalculate valuation. Negative stock must remain negative and must not silently become zero. The selected cost rule must remain explicit when the physical read model is implemented.

### Summary and pagination

KPIs, cost by branch, cost by category, Top N products, state distribution, and health counts are small aggregate outputs and are not paginated. The operational table, valuation table, and product drilldowns use real server-side pagination through `LIMIT/OFFSET` or the repository-standard equivalent. They must never paginate an in-memory complete dataset.

### Section 6 operational table

Section 6 replaces only the `/inventory` operational-table shell. It consumes the certified `public.inventory_bi_base` read model through the additive `GET /inventory/bi-operational-page` contract. The response contains `items` plus `page`, `pageSize`, `total`, and `totalPages` metadata. The default page size is 10 and the defensive maximum is 50. The repository executes a matching `COUNT(*)` and a bounded `LIMIT/OFFSET` query; it never loads the complete dataset for frontend slicing.

The table columns are limited to demonstrated operational facts: Product, SKU, Category, Branch, Current stock, and Stock status. Cost, participation, actions, valuation fields, and export behavior remain outside Section 6. Ordering is deterministic by product name, branch name, product ID, and branch ID. Applied tenant, branch, product, category, and stock-status filters are passed to both count and page queries; `productIds=[]` means no product filter. Terminal, cash, and date context do not affect current-state inventory.

Desktop and intermediate containers at or above 800px use semantic table markup. Containers below 800px use the labeled row-card representation; this decision uses the named `inventory-bi` inline-size container, not viewport media queries, so a wide monitor with an expanded sidebar still gets cards when the usable content is compact. Loading, empty, and table-local error states preserve the surrounding dashboard. Status labels remain textual: `Con stock`, `Agotado`, and `Stock negativo`.

### Section 7 valuation entry

Section 7 enables the existing `Valorización de Inventario` CTA in `/inventory` and navigates with the tenant route segment to `/{tenant}/inventory/valuation`. It does not serialize dashboard filters, use local storage, introduce shared state, or open a PDF. The route uses the existing TenantLayout and the existing `INVENTORY` read permission rule.

The valuation page is a visual shell only: a back link to Inventory, the heading `Valorización de Inventario`, the subtitle `Reporte ejecutivo del inventario a valor de costo`, and neutral reserved surfaces for future valuation filters, summary, analytics, and detail. Sections 8-12 own those functional areas. No valuation data, calculations, endpoint, pagination, export, or fabricated metric is introduced here. The shell inherits the Inventory BI container, spacing, surfaces, typography, and responsive rules without global layout changes.

### Section 8 valuation filters

Section 8 replaces only the valuation filter placeholder with an independent instance of the certified `InventoryBiFiltersPanel`. The valuation instance exposes Tenant, Sucursal, Producto, Categoría, and Estado de stock. It reuses the existing dashboard scope source, category source, `/inventory/products` remote search contract, `productIds` multi-select state, and backend-enforced role behavior. `productIds=[]` means all products. Terminal, cash, and date controls remain excluded from current-state valuation.

Draft changes stay local to the valuation filter instance until `Aplicar filtros`; the applied callback exposes only `requestedTenantId`, `requestedBranchId`, `productIds`, `categoryId`, and `stockStatus` for Sections 9-12. `Limpiar` restores role-required scope defaults and clears optional selections. Tenant and branch changes clear incompatible product/category selections through the certified state transitions. No valuation request is made in Section 8, and no dashboard filters are inherited through URL, storage, or shared state. The panel keeps remote product search with debounce, bounded results, stable product IDs, focus continuity, granular loading/error states, and the existing container-query responsive behavior. Historical DateRangePicker behavior is explicitly out of scope.

### Document export

Future PDF/XLSX export must use the complete filtered dataset, not the visible web page. The implementation must reuse the certified `DocumentExportService` and reportería standard: count first, batches of 1000, `MAX_REPORT_EXPORT_ROWS=100000` or the real configured equivalent, one `REPEATABLE READ READ ONLY` transaction, rollback on failure, and explicit rejection when the limit is exceeded. PDF and XLSX generation remain decoupled from the web page and its pagination.

The export design must not use `jsonb_agg` for the complete dataset and must not export only the visible page.

### Role scope

Scope is enforced by the backend. Frontend controls filter UX only.

- `ADMIN`: tenant and branches allowed by real membership.
- `SUPER_USER`: tenant and branches allowed by demonstrated repository rules.
- `SUPER_ADMIN`: global scope, with optional tenant and branch filters.

The future implementation must not reuse the POS scope resolver unless equivalence with Inventory semantics is demonstrated. User-provided filters may narrow authorized scope but may not widen it.

### Consistency invariants

For the same scope and filters, future automated tests must prove:

```text
total_inventory_cost
  = sum(cost_by_branch)
  = sum(cost_by_category)
  = sum(full_detail_dataset.inventory_cost)

total_units = sum(full_detail_dataset.real_stock)
```

### Performance and database security

Section 0 introduces no materialized views, summary tables, persistent cache, or indexes. Future implementation order is: definitive SQL, `EXPLAIN (ANALYZE, BUFFERS)`, evidence, then optimization. Materialized views or cache require measured cost, especially for `SUPER_ADMIN` global scope.

Read functions are preferred. SQL must be parameterized. `SECURITY INVOKER` is the default. `SECURITY DEFINER` requires demonstrated need plus explicit `search_path`, ownership, `EXECUTE` permissions, and threat review.

## Risks / Trade-offs

- [Current cost semantics are split between product and lot facts] → Keep the future cost rule explicit and block implementation until the contractual source is demonstrated.
- [Role scope drift between API, reportería, and POS] → Do not reuse a resolver without semantic proof; test each role and branch membership.
- [Dashboard and valuation totals diverge] → Use the shared base semantics and the consistency invariants as certification gates.
- [Large exports consume memory or run too long] → Count first, batch at 1000, use one read-only repeatable snapshot, enforce the 100000-row limit, and reject without truncation.
- [Route replacement hides existing capabilities] → Preserve the route contract and maintain the PRESERVE/RELOCATE/REPLACE VISUALLY/GAP matrix before each implementation section.

## Migration Plan

No migration occurs in Section 0. Later sections are incremental and must be validated before the next section begins. Any database migration or physical function will require its own implementation task, review, tests, and evidence.

## Open Questions

- Final physical SQL function names.
- Exact demonstrated source columns and cost rule for every stock type, including lot and legacy inventory.
- Final route-permission and menu strategy for `/{tenant}/inventory/valuation`.
- Whether category is always available for every product row.
- Final export configuration name if it differs from `MAX_REPORT_EXPORT_ROWS=100000`.
