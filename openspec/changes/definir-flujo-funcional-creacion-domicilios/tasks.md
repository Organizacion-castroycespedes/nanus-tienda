## 1. Discovery

- [x] 1.1 Review current delivery creation form, quick-create helpers, delivery API service, and backend delivery relation behavior.
- [x] 1.2 Review current customer, order, sale/factura, payment method, branch, and totals data sources.
- [x] 1.3 Document root causes for missing customer/order/sale options and current subtotal/total behavior.

## 2. Backend

- [x] 2.1 Add safe query/limit support to customer listing.
- [x] 2.2 Add `customerId` support to order listing while preserving tenant/branch scope.
- [x] 2.3 Add `customerId` support to sale listing while preserving tenant/branch scope and existing permissions.
- [x] 2.4 Add focused backend tests for customer search, order customer filter, and sale customer filter.

## 3. Frontend

- [x] 3.1 Add `delivery-totals.ts` helper and focused tests.
- [x] 3.2 Update customer service to support search query/limit.
- [x] 3.3 Update order service to support customer filtering.
- [x] 3.4 Add a sales service for operational sales list filtering.
- [x] 3.5 Update delivery creation form to search customers, load related orders/sales, infer source data, calculate read-only totals, and block negative fees.
- [x] 3.6 Detect existing delivery for selected order/sale and expose manage-existing action instead of submitting duplicates.
- [x] 3.7 Keep manual creation available with subtotal zero and total equal to delivery fee.

## 4. QA and Validation

- [x] 4.1 Create `docs/evidencia-qa-flujo-funcional-creacion-domicilios.md`.
- [x] 4.2 Run `openspec.cmd validate definir-flujo-funcional-creacion-domicilios --type change --strict`.
- [x] 4.3 Run `openspec.cmd validate --all --strict`.
- [x] 4.4 Run focused backend tests.
- [x] 4.5 Run `cd api && npm.cmd run build`.
- [x] 4.6 Run focused frontend delivery tests.
- [x] 4.7 Run `cd web && npm.cmd run lint`.
- [x] 4.8 Run `cd web && npm.cmd run build`.
- [x] 4.9 Run `git diff --check`.
