## 1. Reporting branch authorization prerequisite

- [x] 1.1 Trace token claims, canonical branch assignments and role semantics; verify evidence in `design.md` against the main API source.
- [x] 1.2 Add a typed, fail-closed branch resolver in `backend-reporteria`; verify `npm run build` succeeds.
- [x] 1.3 Cover ADMIN multi-branch/no-filter, authorized and unauthorized filters, empty assignments, cross-tenant and privileged roles; verify the focused `tsx --test` run passes.
- [ ] 1.4 Exercise the resolver with real assignment and branch rows in a safe test database; verify results for ADMIN A/C, a foreign branch, no persona and SUPER_ADMIN.

## 2. Products and Inventory report (future phase)

- [x] 2.1 Version V087 as a SQL STABLE function with tenant/branch scoped CTEs; verify migration file contains independent code, stock and lot aggregation and no new indexes.
- [x] 2.2 Apply V087 on a safe test database and run `scripts/database/tests/20260916_report_product_inventory_readonly_test.sql` plus fixture assertions and EXPLAIN for multi-branch, lot and code filters; verify stock and lot cardinality against known records.
- [x] 2.3 Add typed reporting endpoint, request validation and one snapshot package; verify backend report tests and build pass.
- [x] 2.4 Add PDF, typed XLSX and normal document print controls through the existing viewer; verify automated PDF/XLSX tests pass.
- [x] 2.5 Add compact Products page controls and filters; verify frontend lint/build and client contract tests pass.
- [x] 2.6 Execute manual QA for filters, known SKU/codes, lot balances, costs, branding/logo, multipage PDF, Excel dates, empty results, normal printer and cross-tenant isolation; record actual observations before release.
- [x] 2.7 Add deterministic LIMIT/OFFSET pagination metadata, bounded preview navigation and complete export batching; verify builds and focused contract tests.

## 3. Real report authentication

- [x] 3.1 Restrict mock report authentication to explicit development/test runtimes and preserve 401/403 fail-closed behavior for QA/production.
- [x] 3.2 Verify JWT identity mapping, database branch scope, and product-inventory GENERAL contract remain unchanged.
