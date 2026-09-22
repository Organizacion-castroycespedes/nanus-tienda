## 0. Architecture and OpenSpec

- [x] 0.1 Inspect the current `/{tenant}/inventory` route, component tree, capabilities, child routes, permissions, and repository OpenSpec conventions.
- [x] 0.2 Formalize the approved Section 0 architecture, route replacement contract, preservation matrix, read model, scope, valuation, pagination, export, consistency, security, performance, and visual contracts.

## 1. `/inventory` visual shell

- [x] 1.1 Replace the existing `/inventory` presentation in place with the approved BI shell; do not create a parallel dashboard.
- [x] 1.2 Preserve the existing tenant layout, header, sidebar, global modals, route guard, and permissions.
- [x] 1.3 Implement content-width responsive wide layout without changing the approved intermediate, tablet, or mobile layouts.
- [x] 1.4 Complete manual visual QA for the Section 1 shell and record the certified PASS.

## 2. Scope and filters

- [x] 2.1 Implement the approved scope and filter experience while preserving role-aware behavior.
- [x] 2.2 Validate loading, error, reset, refresh, tenant, branch, terminal, cash, and date behavior.
- [x] 2.3 Extend the existing category read contract with optional authorized `tenantId` support and focused cross-tenant authorization tests.
- [x] 2.4 Extend the existing `/inventory/products` contract with optional scoped server-side `search` and defensive `limit`, replace local product filtering with debounced remote search, and add focused compatibility/scope tests.

## 3. Executive KPIs

- [x] 3.1 Implement the first Inventory BI base CTE, additive `/inventory/bi-summary` contract, and five real executive KPI cards from the demonstrated stock/cost sources.
- [x] 3.2 Add focused tests for stock formula, negative/zero/positive status classification, product/category/status filters, distinct product counts, decimal-safe mapping, and backend scope enforcement.
- [x] 3.3 Perform manual data reconciliation and representative `EXPLAIN (ANALYZE, BUFFERS)` review; confirm KPI cost/units/counts against read-only database evidence. QA passed on sanitized T1/C2 scope; no negative rows existed, endpoint HTTP comparison was not automated, and production-scale representativeness remains limited.

## 4. Capital distribution

- [x] 4.1 Extract the certified inventory semantics into the shared tabular BI base and migrate the Section 3 summary to consume it; regression tests pass.
- [x] 4.2 Implement typed branch/category distributions and Top 5 product aggregation without a full-dataset payload.
- [x] 4.3 Add repository/service tests for shared-base reuse, null-category preservation, bounded Top 5 output, decimal-string mapping, and applied-filter forwarding.
- [x] 4.4 Apply `V091` only to `manus_tienda_qa`, execute read-only database reconciliation, and capture EXPLAIN evidence for summary, branch, category, and Top 5 aggregates.
- [x] 4.5 Complete manual visual QA for the Recharts views and responsive capital layout; certified PASS for homologated BI hierarchy, density, responsive modes, thumbnails, Top 5 table, chart labels/tooltips, and no horizontal overflow.

## 5. Operational health

- [x] 5.1 Complete discovery and contract gate for low stock, out-of-stock, pending document, lot alert, and reconciliation capabilities; preserve demonstrated gaps and do not invent thresholds.
- [x] 5.2 Implement the V1 operational-health contract, preserve alert refresh, and keep operational failures non-blocking; automated, read-only DB, and manual visual QA passed.

## 6. Paginated operational table

- [x] 6.1 Implement the `/inventory` operational table with server-side pagination over `public.inventory_bi_base`, bounded page metadata, and the approved operational columns.
- [x] 6.2 Preserve applied filter scope, status semantics, loading/empty/error behavior, and responsive accessibility without changing legacy dashboard capabilities.
- [x] 6.3 Verify that count and items use backend `COUNT` plus `LIMIT/OFFSET`; no complete dataset is paginated in memory. Automated, read-only DB, and manual visual QA passed: desktop table, pagination, sidebar reflow, WIDE/INTERMEDIATE KPI layouts, monetary KPI formatting, and compact/mobile operational cards.

## 7. Valuation CTA

- [x] 7.1 Add the enabled valuation CTA from `/inventory` and render the Section 7 structural valuation shell. Automated and manual visual QA passed.
- [x] 7.2 Navigate to the approved `/{tenant}/inventory/valuation` route without transferring dashboard filters or opening a PDF. Manual navigation QA passed: direct navigation, refresh, tenant context, and return link verified.
- [x] 7.3 Apply the existing `INVENTORY/READ` route permission and preserve TenantLayout behavior. Automated and manual navigation/visual QA passed.

## 8. Valuation shell and filters

- [x] 8.1 Create `/{tenant}/inventory/valuation` as the specialized current valuation view and replace only its filter placeholder with the certified filter panel. Automated validation passed.
- [x] 8.2 Implement independent draft/applied Tenant, Sucursal, Producto, Categoría, and Estado de stock filters using backend-enforced scope, remote product search, and stable `productIds`. Automated and manual functional/visual QA passed.
- [x] 8.3 Do not add a DateRangePicker or Terminal/Caja context to current-state valuation without a later functional decision.
- [x] 8.4 Complete manual desktop, POS, and mobile QA for scope dependencies, apply/reset, remote product multi-select focus, and no inherited dashboard filters. Automated and manual functional/visual QA passed.

## 9. Valuation KPIs

- [x] 9.1 Implement current valuation quantity and cost KPIs from the shared base read model through the existing `/inventory/bi-summary` contract. Automated and read-only QA passed.
- [x] 9.2 Preserve negative stock semantics, decimal-string transport, and prevent frontend valuation recalculation. Automated and read-only QA passed; no negative rows existed in the QA dataset.
- [x] 9.3 Complete manual visual QA for applied-filter refresh, KPI formatting, loading/error/zero states, and responsive layout. Automated, DB, and manual functional/visual QA passed.

## 10. Valuation analytics

- [x] 10.1 Implement branch, category, bounded Top 5 product, and status analytics as non-paginated aggregates by reusing the certified BI endpoints. Automated validation passed.
- [x] 10.2 Certify that branch/category analytics reconcile with the valuation total and preserve null-category/Top 5 semantics. Read-only QA passed on `manus_tienda_qa`; no new SQL was required.
- [x] 10.3 Complete manual visual QA for charts, compact thumbnail/fallback ranking, status distribution, responsive sidebar reflow, labels/tooltips, and empty/error states. User-confirmed desktop, POS/intermediate, and mobile QA passed without visible document overflow.

## 11. Valuation table

- [x] 11.1 Implement the valuation detail table with real server-side pagination through `GET /inventory/bi-valuation-page`, using the certified BI base and typed page metadata. Automated and read-only QA passed.
- [x] 11.2 Add product-level valuation rows with the repository-standard `COUNT(*)` plus `LIMIT/OFFSET` mechanism, complete-filter participation, decimal-safe costs, and responsive table/card rendering. Automated and read-only QA passed.
- [x] 11.3 Verify tenant and branch isolation for every valuation query by reusing the certified backend scope resolver and parameterized BI-base call. Automated scope-preservation coverage and user-confirmed manual visual/functional QA passed.

## 12. Document export

Implementation evidence: `POST /reports/inventory-bi-valuation` uses the certified reporteria export engine, complete filtered read model, 1000-row batches, the configured 100000-row rejection limit, and a repeatable-read read-only snapshot. Automated, read-only, and manual PDF/XLSX document QA passed.

- [x] 12.1 Reuse the certified `DocumentExportService` and reporteria export standard.
- [x] 12.2 Implement count-first, 1000-row batching, configured maximum, repeatable-read read-only transaction, rollback, and explicit over-limit rejection.
- [x] 12.3 Generate PDF and XLSX from the complete filtered dataset, independent of web pagination.
- [x] 12.4 Add export contract tests for empty, bounded, over-limit, and concurrent-data scenarios.

Presentation evidence: `POST /reports/inventory-bi-valuation` resolves authorized applied filter IDs to readable company, branch, product, category, and stock-status labels. PDF summary/detail values use readable COP, unit, and percent formats with generation time in COT. XLSX uses `Resumen`/`Detalle` sheets, readable headers, filters, widths, and safe decimal handling. Manual PDF/XLSX QA passed for the complete dataset and the representative CARNICOS filter.
Residual presentation fix: report status enums are normalized from the real uppercase/lowercase values to `Con stock`, `Agotado`, and `Stock negativo` in both formats. Participation is rendered consistently as localized exact text for zero, 100, and fractional values; economic source strings remain unchanged. Manual QA passed.
PDF table refinement: the landscape detail table now reserves a dedicated wider Estado column, uses compact cell padding, and keeps status cells non-wrapping so all nine fields remain visible without horizontal clipping. Manual QA passed for both PDF margin criteria.

## 13. Responsive and accessibility

Implementation note: automated/static review fixed the mobile-open Producto multi-select
container sizing and keyboard/focus semantics. Manual viewport and interaction evidence
was confirmed by the user: desktop 1440/1280 with both sidebar states, intermediate
1024/768, mobile 480 with the dropdown open, multi-selection and chip removal, keyboard
navigation and Escape, draft/applied behavior, loading/empty/error states, and preserved
pagination, charts, and export controls. No API, DB, or business contract changed.

- [x] 13.1 Validate the approved BI layout at widths above 1440, 1280, 1024, 768, and 480.
- [x] 13.2 Validate keyboard access, labels, focus, table semantics, contrast, and responsive overflow.
- [x] 13.3 Confirm use of existing icon library, typography, design tokens, flex/grid layout, and no prohibited visual patterns.
- [x] 13.4 Revalidate the open Producto searchable multi-select on mobile, including all selected items, individual removal, compact height, and the explicit `+N` summary indicator.

## 14. Global QA

- [ ] 14.1 Run automated tests for scope, source-of-truth formula, pagination, export, and consistency invariants.
- [ ] 14.2 Validate every existing Inventory child route and current dashboard capability after replacement.
- [ ] 14.3 Run security review for SQL parameters, function privileges, scope enforcement, and any future `SECURITY DEFINER` use.
- [ ] 14.4 Record implementation evidence and certify the complete Inventory BI and valuation flow before release.
