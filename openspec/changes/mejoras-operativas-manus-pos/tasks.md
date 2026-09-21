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
