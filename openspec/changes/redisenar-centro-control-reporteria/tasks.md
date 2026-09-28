## 1. Inspection and contract gate

- [x] 1.1 Record confirmed reporteria routes, existing services, role scope, tables, functions, indexes and chart dependency in implementation notes.
- [x] 1.2 Resolve pending order-state and active-cashier definitions from repository schema/report functions before SQL implementation.

## 2. Database read model

- [x] 2.1 Add one additive versioned migration with `STABLE SECURITY INVOKER` operational-control function and least-privilege execute grant.
- [x] 2.2 Implement role/tenant/branch/user/terminal/cashier scope, COT period bounds, hourly/daily buckets and bounded JSONB sections.
- [ ] 2.3 Add SQL/service tests for mixed payments, cancellations/refunds, empty ranges, date limits, tenant isolation and reconciliation.

## 3. Backend contract

- [x] 3.1 Add typed query validation, period normalization and actor-scope resolution without changing existing report DTOs.
- [x] 3.2 Add `GET /reports/operational-control` with stable meta, filters, metrics, charts and availability response.
- [x] 3.3 Add authorization tests for USER input rejection and manipulated scope parameters; SQL role predicates cover all four roles.

## 4. Frontend control center

- [x] 4.1 Add typed service/hook for snapshot loading with abort-safe refresh and loading/error/empty/unavailable states.
- [x] 4.2 Redesign only the reporteria landing page: compact header, quick links, KPIs, secondary filters and chart panels.
- [x] 4.3 Reuse Recharts, existing icons/tokens and preserve five specialized links/routes and route permissions.
- [x] 4.4 Add chart labels, legends, currency formatting and no-horizontal-overflow responsive CSS.

## 5. Verification and handoff

- [x] 5.1 Run backend-reporteria focused tests, web lint/build, backend build and strict OpenSpec validation.
- [ ] 5.2 Run QA at mobile, POS terminal, narrow container and desktop widths; verify two-column chart threshold and one-column fallback.
- [ ] 5.3 Run read-only QA reconciliation and `EXPLAIN (ANALYZE, BUFFERS)` on representative authorized scopes.
- [x] 5.4 Report branch, HEAD, files, migration/function, contracts, tests, QA, risks, pending questions and final Git status; leave uncommitted and unpushed.

## 6. QA corrections: attribution and hierarchy

- [x] 6.1 Re-inspect the deployed local schema and confirm `sales.user_id`, `cash_movements.created_by`, `cash_sessions`, `cash_registers`, `terminals`, branches and user/persona relations before changing the function.
- [x] 6.2 Extend `report_operational_control` with effective role scope, terminal/cashier intersection, dependent option lists and bounded sales/cash details without changing specialized report contracts.
- [x] 6.3 Add the compact hierarchical filter bar and role-aware detail blocks while preserving the five quick links and four existing charts.
- [ ] 6.4 Add or execute negative live checks for USER, ADMIN and SUPER_USER cross-scope filters and the SUPER_ADMIN tenant hierarchy.
- [ ] 6.5 Repeat responsive QA at mobile, POS, narrow-container and desktop widths; confirm two-column charts only when legible and one-column mobile fallback.
- [ ] 6.6 Reconcile filtered KPI/chart/detail totals with specialized POS and Caja reports and capture `EXPLAIN (ANALYZE, BUFFERS)` evidence.
