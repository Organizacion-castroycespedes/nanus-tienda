## 1. Diagnostics

- [x] 1.1 Review backend controllers, guards, menu keys, and tests for customers, products, taxes, roles, and terminals.
- [x] 1.2 Review frontend route permissions, menu filtering, and action permissions for customers, orders, POS, inventory, finance, roles, and terminals.
- [x] 1.3 Review SQL menu and role permission seeds/migrations for Inventory and operational reads.

## 2. Backend

- [x] 2.1 Allow customer create/update for `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN`.
- [x] 2.2 Allow operational read access to customers, products, and taxes for POS/Orders roles.
- [x] 2.3 Preserve backend denial for USER administrative inventory writes, Roles, and Terminales regressions.
- [x] 2.4 Add or update backend tests for the permission metadata/guards changed by this hotfix.

## 3. Frontend

- [x] 3.1 Enable customer create/edit UI for `USER`, `ADMIN`, and `SUPER_USER`.
- [x] 3.2 Ensure Orders and POS dependency loading can work for `USER` without inventory admin visibility.
- [x] 3.3 Hide and block administrative `/inventory` routes for `USER` while preserving Finanzas visibility and Roles/Terminales restrictions.
- [x] 3.4 Add or update frontend permission and route tests.

## 4. SQL

- [x] 4.1 Add idempotent SQL to remove `USER` administrative Inventory menu permissions for tenant `00000000-0000-0000-0000-000000000001`.
- [x] 4.2 Validate SQL idempotency locally by applying it twice when local DB access is available.
- [x] 4.3 Confirm QA and production databases are not touched.

## 5. Evidence and Validation

- [x] 5.1 Create evidence document without JWT, cookies, tokens, passwords, `DATABASE_URL`, `DB_PASSWORD`, or SSH keys.
- [x] 5.2 Run OpenSpec, API, web, SQL, diff, and status validations available in the local environment.
- [x] 5.3 Record root causes, changed files, validation results, and deployment/push/commit status.

## 6. Fiscal customers follow-up

- [x] 6.1 Diagnose `/customers` calls to `GET/PATCH /api/electronic-invoicing/customers`.
- [x] 6.2 Allow operational roles on fiscal customer list/create/update/detail/default endpoints without opening suppliers or broader electronic-invoicing modules.
- [x] 6.3 Extend idempotent SQL for backend-only `ELECTRONIC_INVOICING_CUSTOMERS` permissions.
- [x] 6.4 Add focused backend tests and update evidence.

## 7. Pricing preview follow-up

- [x] 7.1 Diagnose POS calls to `POST /api/pricing/preview-line`.
- [x] 7.2 Allow operational roles on pricing preview-line without granting promotion administration.
- [x] 7.3 Add focused pricing/guard tests and update evidence.
- [x] 7.4 Validate POS preview-line smoke for operational roles locally.
