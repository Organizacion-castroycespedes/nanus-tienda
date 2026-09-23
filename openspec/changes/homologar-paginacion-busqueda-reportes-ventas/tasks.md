## 1. Discovery

- [x] 1.1 Verify branch, working tree, prior visual change and base revisions.
- [x] 1.2 Inspect Pagination, DataTable, report modules and operational contracts.
- [x] 1.3 Confirm POS and operational sales have independent scope/report contracts.
- [x] 1.4 Confirm current auth, environment, deployment and document-engine facts.

## 2. Pagination

- [x] 2.1 Evolve design-system Pagination with range, total, sizes, numbers and boundary controls.
- [x] 2.2 Integrate POS, Clientes, Pedidos, Compras and Caja Arqueos without double pagination.
- [x] 2.3 Integrate server-side pagination in operations/sales and preserve applied filters.

## 3. Operational sales

Status note: the historical blocked wording on task 3.4 is superseded by the
implemented direct JWT/PostgreSQL operational report contract described below.
The implementation and export tests are complete; only live browser and
authorized role QA remain pending.

- [x] 3.1 Separate draft/applied filters and add explicit Buscar.
- [x] 3.2 Add request concurrency protection and tests for stale responses.
- [x] 3.3 Add only existing detail action if the route still lacks Actions.
- [x] 3.4 Implement independent PDF/XLSX report with the verified direct JWT/PostgreSQL scope contract; role-based E2E and responsive QA remain tracked separately as pending.

## 4. Actions and QA

Implementation note: task 3.4's earlier design-blocked note is superseded by
the direct, route-specific JWT and PostgreSQL scope implementation documented
in `design.md`. No API-to-reporteria delegation or replay store is used.

- [x] 4.1 Move existing Actions first only through explicit `actionColumnFirst`/`actionFirst`; preserve Caja Cierres and inventory tables.
- [x] 4.2 Add pagination, visual integration and operational PDF/XLSX export tests.
- [x] 4.3 Run lint, builds, OpenSpec strict and git diff --check; classify pre-existing failures.
- [ ] 4.4 Run responsive/browser QA at requested viewports or record BLOCKED/PENDING evidence.

## 5. Operational export security and QA

- [x] 5.1 Compare API-local generation with API-authority plus reportería-renderer delegation.
- [x] 5.2 Define signed authorization fields, issuer, audience, expiry, replay and digests.
- [x] 5.3 Define isolation, shift, tenant, role, limit, document and audit test matrix.
- [x] 5.4 Implement direct JWT export without API-to-reporteria delegation; validate `auth_sessions`, `x-pos-session-id`, POS/READ permission, tenant, branches and USER cash session on every request.
- [x] 5.5 Reuse `DocumentExportService`, `PdfmakeEngine`, `exceljs` and branding query with an independent operational adapter and template.
- [ ] 5.6 Run live database and browser responsive QA; pending local services/authentication/browser.
- [x] 5.7 Correct operational PDF logo composition and bound all eight columns to the A4 landscape content width.
- [ ] 5.8 Render and inspect first, middle, and last PDF pages when Poppler or an equivalent renderer is available.
- [x] 5.9 Diagnose pdfmake 0.2.10 default table padding and replace the naive width-only check with effective exterior-width coverage.
- [x] 5.10 Compare XLSX Documento value `23` against QA `electronic_documents` rows before changing any data mapping; no mapping defect found.
- [x] 5.11 Close Documento `23`: sharedStrings index false positive; QA PostgreSQL and XLSX package contain zero literal fiscal `23` values.
- [ ] 5.12 Complete authorized role-based E2E and responsive browser QA when QA sessions and browser infrastructure are available.
- [x] 5.13 Close `RowActionsMenu` before every existing action callback for both `items` and `children`, with synchronous, asynchronous and error-path coverage.
- [x] 5.14 Move Caja Cierres `Acciones` to the first column using the existing opt-in configuration; preserve Caja Arqueos and all action contracts.

## 6. Final implementation note

- [x] 6.1 `/reports/operational-sales` is independent. `/reports/pos-sales` and `/report_resolve_pos_scope` are untouched.
- [x] 6.2 PDF/XLSX use applied filters, deterministic ordering, full authorized dataset, 1,000-row batches and the 100,000-row limit.
- [x] 6.3 Frontend enables Reporte only after Buscar and sends the validated POS session header.

## 7. Final QA evidence

- [x] 7.1 Record user-confirmed manual QA PASS for transversal RowActionsMenu
  closure before actions, PDF/modal overlap prevention, and first-column
  Actions in Caja Cierres and Caja Arqueos. This confirms the reported visual
  defects only; it does not certify unexecuted role-based scenarios.
- [ ] 7.2 Execute authorized role-based E2E and responsive QA when browser,
  QA credentials and live sessions are available.
