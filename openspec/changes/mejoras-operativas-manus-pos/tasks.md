## 1. Inspection and contracts

- [x] 1.1 Confirm current POS customer selector, shared tenant layout, inventory dashboard, purchase receiving, POS report, design-system and Electron loading path.
- [x] 1.2 Confirm inventory cost source and dashboard response types; stop if no single persisted rule is demonstrable.
- [x] 1.3 Confirm supplier invoice fields, receiving transaction boundaries and DIAN accepted enum/action contract.

## 2. POS and navigation

- [x] 2.1 Add stable Spanish A-Z customer ordering with focused tests and preserve search/selection behavior.
- [x] 2.2 Apply the shared <=1280px drawer and >1280px persistent sidebar rule with accessible active state and focused tests where supported.

## 3. Inventory

- [x] 3.1 Add backend `inventoryCostTotal` only from the confirmed cost source and test the response/calculation.
- [x] 3.2 Redesign inventory dashboard around existing real contract fields, compact filters, KPIs, tables, trends and explicit states without illustrative data.

## 4. Purchase receiving

- [x] 4.1 Extend receiving DTO/entity/repository/response with the demonstrated supplier invoice field and date only when required and absent.
- [x] 4.2 Persist supplier invoice atomically in the existing receiving transaction and test success, retrieval and rollback.
- [x] 4.3 Implement the compact Información -> Productos -> Confirmación receiving UX with nearby validation.

## 5. POS reports and reusable pattern

- [x] 5.1 Add the reusable report layout composition using existing tokens, table, states and pagination primitives.
- [x] 5.2 Redesign POS report toolbar, current-day initial query, summary and table using the existing pagination.
- [x] 5.3 Gate electronic document action on the real accepted-DIAN enum while preserving conventional POS ticket behavior.

## 6. Validation

- [x] 6.1 Add/update focused tests for all five improvements and the reusable report components.
- [x] 6.2 Run OpenSpec strict validation, relevant lint, tests and builds; separate pre-existing failures from regressions.
- [x] 6.3 Perform Web/Electron visual QA at 1280x1024, desktop above 1280 and mobile; record PASS/FAIL/PARTIAL/BLOCKED evidence.

## 7. Progressive standard-report adoption

- [x] 7.1 Adopt the reusable compact report composition in `/reporteria/caja`, preserving closings/audits queries, tabs, summaries, exports and ticket actions.
- [x] 7.2 Adopt the reusable compact report composition in `/reporteria/compras`, preserving status/date/scope filters, summaries, exports and ticket actions.
- [x] 7.3 Adopt the reusable compact report composition in `/reporteria/pedidos`, preserving scope filters, order states, summaries, exports and ticket actions.
- [x] 7.4 Adopt the reusable compact report composition in `/reporteria/clientes`, preserving customer filters and aggregates without adding unsupported date filters or metrics.
- [x] 7.5 Add focused metadata coverage and validate the four report routes without changing backend contracts.

## 8. Standard document export pilot

- [x] 8.1 Define a reusable server-side export pipeline with count, 1000-row real batches, `MAX_EXPORT_ROWS = 100000`, no silent truncation and one `REPEATABLE READ READ ONLY` snapshot.
- [x] 8.2 Add POS export queries/adapters that preserve `report_resolve_pos_scope`, actor permissions, tenant, branch and date semantics without materializing `report_pos_sales` JSON.
- [x] 8.3 Reuse the corporate branding source and configurable report definition for POS PDF and Excel output.
- [x] 8.4 Integrate one compact POS `Reporte` action with the existing `PdfPreviewModal`, preserving individual POS/electronic ticket actions.
- [x] 8.5 Add focused backend/frontend tests for count, batching, limit, scope parity, branding fallback and PDF/Excel/print actions.
- [ ] 8.6 Validate POS API/Web tests, builds, lint, OpenSpec strict and diff check; leave Caja Cierres/Arqueos, Compras, Pedidos and Clientes for later adoption after pilot certification and manual QA.
- [x] 8.7 Correct POS PDF landscape layout, repeated headers, indivisible rows and readable corporate scope names without changing the export dataset.
- [x] 8.8 Remove the frontend-only legacy POS reconciliation download action while preserving the standard `Reporte` viewer actions.
