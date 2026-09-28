## Context

The repository has a Next.js reporteria shell and specialized pages for POS sales, cash, purchases, orders and customers. `backend-reporteria` already authenticates JWTs, resolves report roles, invokes PostgreSQL reporting functions, and uses `America/Bogota` date semantics. Current landing data loads POS and cash datasets directly and does not expose a stable consolidated snapshot. Existing SQL establishes `report_resolve_pos_scope`, `report_pos_sales`, `report_cash_closings`, payment/cash-session tables, orders, customers and terminals.

The change must be additive, preserve existing pages, avoid N+1 queries, and keep authorization outside client control. `USER` is restricted to the actor's authorized operational records and current cash context; `ADMIN` is branch-scoped; `SUPER_USER` is tenant-scoped; `SUPER_ADMIN` may select an authorized tenant and branch. The backend must validate every requested scope.

## Goals / Non-Goals

**Goals:**

- One bounded snapshot contract for landing KPIs and four chart datasets.
- PostgreSQL performs aggregation and time bucketing.
- Stable period and scope metadata, explicit loading/error/empty semantics, and accessible chart alternatives.
- Responsive first-screen layout with no horizontal overflow and two-column charts only when usable inline space allows.
- Reconciliation rules that avoid duplicate mixed-payment sales and distinguish current open cash from historical totals.

**Non-Goals:**

- No replacement or redesign of specialized report pages.
- No new frontend dependency if existing Recharts is sufficient.
- No changes to Electron, Peripheral Agent, electronic billing, historical records or business write flows.
- No fabricated metrics when a source or permission is unavailable.

## Decisions

1. **Additive snapshot endpoint.** Add `GET /reports/operational-control` rather than changing existing report response shapes. Query accepts bounded `period`, optional scope IDs and validated ISO bounds; response contains `meta`, `metrics`, `charts`, `availability` and `filters`.

2. **Database aggregation.** Add one `STABLE`, `SECURITY INVOKER` PostgreSQL function with typed JSONB output. It receives actor identity/role, requested tenant/branch, optional terminal/cashier and period bounds. It calls the same effective-scope rules and aggregates sales, payments, cash movements and order states in separate CTEs. Sales are counted once; payment-method chart groups payment rows without summing them into sales totals.

3. **Backend scope first.** A service resolves and validates period and UUID filters, invokes the function with actor claims, and rejects invalid or unauthorized requests. The SQL function repeats tenant and role predicates. The frontend only sends requested filters and renders returned values.

4. **Stable period model.** `TODAY` uses the current COT calendar day; `LAST_7_DAYS` and `LAST_30_DAYS` use explicit half-open UTC bounds derived by the existing report date utility. Series bucket hourly for TODAY and daily otherwise. The response returns resolved bounds and timezone.

5. **Small presentation model.** KPIs are `netSales`, `transactions`, `openCashSessions`, `activeCashiers`, `pendingOrders`, and permission-aware `cashDifference`. Purchases and customers get only bounded summary counts/amounts when source data and permission exist. Unavailable fields carry an availability reason; zero is a real zero.

6. **Responsive composition.** The page uses existing design-system cards, buttons, tokens, icons and Recharts. Quick links sit directly below the compact header. CSS grid uses `minmax(0,1fr)` and container-aware breakpoints; charts are two columns only when each card remains readable and one column in narrow containers/mobile.

7. **QA correction: effective scope and dependent filters.** The function derives one effective scope from the authenticated actor and intersects requested `tenantId`, `branchId`, `cashierId` and `terminalId` with it. `USER` is fixed to the actor; `ADMIN` is fixed to the actor branch; `SUPER_USER` is fixed to the actor tenant; `SUPER_ADMIN` may select an existing tenant and then its branch. Invalid cross-scope values raise a database error and never widen results. The response returns bounded option lists for the current scope so the UI can invalidate dependent selections.

8. **QA correction: bounded operational detail.** The same function returns at most eight recent sales and eight recent cash movements. Rows join demonstrated `sales`, `cash_movements`, `cash_sessions`, `cash_registers`, `terminals`, `users`, `personas` and `tenant_branches` relations. The landing page shows attribution for administrative roles and hides redundant identity columns for `USER`; full navigation remains on specialized POS and Caja reports.

## Risks / Trade-offs

- [Existing role implementations differ between report services] -> Centralize the new endpoint through the existing report actor/scope path and add negative tests for manipulated tenant, branch, terminal and cashier IDs.
- [Payment joins can double-count mixed payments] -> Count sales from `sales` only; aggregate payment methods in an independent CTE and test mixed-payment fixtures.
- [Function output can drift from specialized reports] -> Reconcile the same scope/period against `report_pos_sales` and cash report summaries in service/SQL tests.
- [Small POS screens have little width] -> Use bounded cards, visible labels, compact filters, no fixed page widths, and accessible tabular/text fallbacks for charts.
- [Some databases may lack a required optional table] -> Migration checks required objects and endpoint returns explicit unavailable sections; no mock production data.

## Migration Plan

Apply the additive migration after existing reporting migrations. Verify function signature, owner, `SECURITY INVOKER`, and grants in QA. Deploy backend before frontend, then run contract, isolation, reconciliation and responsive QA. Rollback drops only the new function and endpoint code; it does not alter data or existing functions.

## Open Questions

- Confirm exact existing order pending-state enum values from the deployed schema before finalizing the pending-orders predicate.
- Confirm whether active-cashier means distinct operators with an open session or operators with activity in the period; implementation must use the demonstrated operational definition, not a new one.
- Confirm production representative performance with `EXPLAIN (ANALYZE, BUFFERS)` before release.
- Manual QA must prove the four role matrix cases; compilation alone does not move USER/ADMIN/SUPER_USER/SUPER_ADMIN status to PASS.
