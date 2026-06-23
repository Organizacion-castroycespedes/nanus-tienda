## 1. Discovery

- [x] 1.1 Verify whether `deliveries.sale_id` already exists in migrations, API types and frontend types.
- [x] 1.2 Identify the backend point where an order generates a sale.
- [x] 1.3 Check existing delivery query/create safeguards for `order_id` and `sale_id`.

## 2. Backend

- [x] 2.1 Add additive migration only if `deliveries.sale_id` is missing.
- [x] 2.2 Implement idempotent association of an existing order delivery to a generated sale.
- [x] 2.3 Ensure delivery list/query supports `sale_id`.
- [x] 2.4 Ensure duplicate delivery creation is blocked for the same order/sale flow.
- [x] 2.5 Add focused backend tests for sale association and duplicate prevention.

## 3. Frontend

- [x] 3.1 Ensure delivery list/detail show the sale reference when available.
- [x] 3.2 Ensure sale/order UI exposes existing delivery instead of duplicate creation when available.
- [x] 3.3 Keep responsive behavior and operational labels.

## 4. QA and Validation

- [x] 4.1 Create `docs/evidencia-qa-vinculo-domicilios-ventas.md`.
- [x] 4.2 Run `openspec.cmd validate vincular-domicilios-con-ventas --type change --strict`.
- [x] 4.3 Run `openspec.cmd validate --all --strict`.
- [x] 4.4 Run focused backend tests.
- [x] 4.5 Run API build if API changed.
- [x] 4.6 Run frontend focused tests if frontend helpers changed. N/A: no frontend helper changes.
- [x] 4.7 Run web lint and build.
- [x] 4.8 Run `git diff --check`.
