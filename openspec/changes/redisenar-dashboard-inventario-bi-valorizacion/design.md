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

The responsive foundation uses the repository's Tailwind defaults (`sm`, `md`, `lg`) for approved intermediate and compact layouts. The Inventory BI main element is also a named inline-size container; only when its usable content width reaches 1280px do six KPI columns, three capital panels (4/4/4), and the health cards/status row (6/6) activate. This avoids treating monitor viewport width as available width after the TenantLayout sidebar. The page is full width with responsive padding, 16px section gaps, no structural absolute positioning, and no body-level horizontal overflow. KPI cards retain a 160px minimum width. Capital and health groups have their own visible headings above the existing grids.

Loading is represented by stable structural skeletons with `aria-busy` on the dashboard and no fabricated metrics. The component exposes `viewState="error"` and an optional retry callback for the later data integration; the error copy is exactly `No fue posible cargar el Dashboard de Inventario.` The refresh button accepts an optional existing refresh callback and remains disabled in this shell because Section 1 does not alter the current data contract. The valuation CTA is disabled and does not navigate because its route is not implemented yet.

### Section 2 scope and filters implementation

Section 2 replaces the filter skeleton with `InventoryBiFiltersPanel`. It owns one typed `InventoryBiFilters` state containing requested tenant/branch, `productIds`, category, stock status, and secondary terminal/cash/date context. An empty `productIds` array means all products. The single user-facing Producto control is a searchable multi-select: each remote result toggles one stable product ID without duplicates, the closed control keeps compact density, and the open control shows every selected item with individual removal. Apply is explicit; changing tenant or branch clears product selections that no longer belong to the new scope, along with dependent operational context. Reset returns to the authenticated tenant/branch defaults and sets `productIds` to `[]` without widening restricted scope.

The panel reuses the existing `/inventory/dashboard`, `/inventory/products`, and `/inventory/product-categories` contracts for options. The demonstrated backend behavior is: `SUPER_ADMIN` can request global tenants and active branches; `SUPER_USER` is tenant-fixed and the current backend grants all active branches in that tenant; `ADMIN` is tenant/branch constrained by membership and the dashboard exposes branch as fixed context. Frontend controls do not authorize requests. The category route accepts an optional `tenantId` for this read use-case and validates it with the existing `AccessControlService`; only `SUPER_ADMIN` may widen the tenant, while restricted actors remain tenant-bound. The existing `/inventory/products` route now accepts optional `search` and `limit` parameters while preserving its array response and legacy behavior when omitted. Search is parameterized SQL over demonstrated `products.name` and `products.sku`, applied to the authorized tenant/branch scope before the defensive server maximum of 25 rows. The filter waits for product text, debounces 300 ms, requests `limit=25`, and invalidates stale tenant/branch results. No catalog-wide client download remains.

Primary filters are Tenant, Sucursal, Producto, Categoría, and Estado de stock. The demonstrated stock fields support `all`, `in_stock`, `out_of_stock`, and `negative`; `Stock bajo` is intentionally omitted because the repository does not demonstrate the exact minimum-stock calculation used by the legacy dashboard function. Terminal, Caja, Fecha inicial, and Fecha final remain under `Más filtros` as operational context for future secondary consumers and do not trigger BI calculations in Section 2.

Section 2 role and visual QA are accepted. The specific check of the open Producto multi-select on mobile is intentionally deferred to Section 13 responsive/accessibility QA and is not a Section 2 blocker. A minor follow-up may make the closed compact summary's `+N` indicator more explicit when more than two selections exist; the multi-select contract itself is complete.

The previous `InventoryDashboard.tsx`, its operational consumers, child routes, and `TenantLayout` remain preserved. Section 2 only adds backward-compatible optional read parameters to existing category and Inventory product routes; no response shape, BI endpoint, or authorization architecture is replaced. This preserves the operational implementation for later re-homing and avoids deleting current capabilities.

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
