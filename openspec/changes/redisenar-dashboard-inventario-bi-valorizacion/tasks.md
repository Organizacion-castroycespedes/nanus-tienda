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

- [ ] 5.1 Relocate low stock, out-of-stock, pending document, lot alert, and reconciliation capabilities.
- [ ] 5.2 Preserve alert refresh and non-blocking alert failure behavior.

## 6. Paginated operational table

- [ ] 6.1 Implement the `/inventory` operational table with server-side pagination.
- [ ] 6.2 Preserve movements, purchases, critical products, pending orders, status, scope, and error semantics.
- [ ] 6.3 Verify that no complete dataset is paginated in memory.

## 7. Valuation CTA

- [ ] 7.1 Add the valuation CTA from `/inventory`.
- [ ] 7.2 Navigate to the approved target route instead of opening a PDF directly.
- [ ] 7.3 Implement and review the future route-permission and menu strategy.

## 8. Valuation shell and filters

- [ ] 8.1 Create `/{tenant}/inventory/valuation` as the specialized current valuation view.
- [ ] 8.2 Implement tenant, branch, product, category, and status filters using backend-enforced scope.
- [ ] 8.3 Do not add a DateRangePicker unless a later functional decision approves historical behavior.

## 9. Valuation KPIs

- [ ] 9.1 Implement current valuation quantity and cost KPIs from the shared base read model.
- [ ] 9.2 Preserve negative stock semantics and prevent frontend valuation recalculation.

## 10. Valuation analytics

- [ ] 10.1 Implement branch, category, product Top N, and status analytics as non-paginated aggregates.
- [ ] 10.2 Certify that valuation analytics reconcile with the detail dataset.

## 11. Valuation table

- [ ] 11.1 Implement the valuation detail table with real server-side pagination.
- [ ] 11.2 Add product drilldowns with the repository-standard pagination mechanism.
- [ ] 11.3 Verify tenant and branch isolation for every query.

## 12. Document export

- [ ] 12.1 Reuse the certified `DocumentExportService` and reportería export standard.
- [ ] 12.2 Implement count-first, 1000-row batching, configured maximum, repeatable-read read-only transaction, rollback, and explicit over-limit rejection.
- [ ] 12.3 Generate PDF and XLSX from the complete filtered dataset, independent of web pagination.
- [ ] 12.4 Add export contract tests for empty, bounded, over-limit, and concurrent-data scenarios.

## 13. Responsive and accessibility

- [ ] 13.1 Validate the approved BI layout at widths above 1440, 1280, 1024, 768, and 480.
- [ ] 13.2 Validate keyboard access, labels, focus, table semantics, contrast, and responsive overflow.
- [ ] 13.3 Confirm use of existing icon library, typography, design tokens, flex/grid layout, and no prohibited visual patterns.
- [ ] 13.4 Revalidate the open Producto searchable multi-select on mobile, including all selected items, individual removal, compact height, and the explicit `+N` summary indicator.

## 14. Global QA

- [ ] 14.1 Run automated tests for scope, source-of-truth formula, pagination, export, and consistency invariants.
- [ ] 14.2 Validate every existing Inventory child route and current dashboard capability after replacement.
- [ ] 14.3 Run security review for SQL parameters, function privileges, scope enforcement, and any future `SECURITY DEFINER` use.
- [ ] 14.4 Record implementation evidence and certify the complete Inventory BI and valuation flow before release.
