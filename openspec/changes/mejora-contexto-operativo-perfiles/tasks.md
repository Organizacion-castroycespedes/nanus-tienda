## 1. Discovery and Scope Mapping

- [x] 1.1 Map current auth/session/context flow from login to tenant pages and POS.
- [x] 1.2 Map current backend role, permission and branch/tenant scope helpers.
- [x] 1.3 Map current terminal, POS session and cash session models/endpoints.
- [x] 1.4 Map current route/menu/action permission helpers in frontend.

## 2. Backend Operational Context

- [x] 2.1 Add or reuse backend helper to resolve effective tenant/branch scope by role.
- [x] 2.2 Add or reuse backend validation for branch, terminal and POS/cash session ownership.
- [x] 2.3 Ensure terminal/context endpoints return only options permitted for `USER`, `ADMIN`, `SUPER_USER` and `SUPER_ADMIN`.
- [x] 2.4 Ensure operational endpoints reject out-of-scope `branchId`, `terminalId` and `x-pos-session-id` with `403`.

## 3. Backend Profile Permissions

- [x] 3.1 Allow `USER` and `ADMIN` to open/close cash sessions only in allowed scope.
- [x] 3.2 Allow `USER`, `ADMIN` and `SUPER_USER` to create/update orders in allowed scope.
- [x] 3.3 Allow `USER`, `ADMIN` and `SUPER_USER` to list/create/update customers and basic electronic-invoicing customer data in allowed scope.
- [x] 3.4 Allow `SUPER_USER` to list assignable roles without global role mutation authority.
- [x] 3.5 Allow `ADMIN` read-only operational inventory access in assigned scope.
- [x] 3.6 Allow `SUPER_USER` full tenant inventory management without cross-tenant access.

## 4. Frontend Context and Permissions

- [x] 4.1 Resolve post-login operational context and route users to selector only when needed.
- [x] 4.2 Block `/pos` without complete valid context and keep `/pos/select-context` authenticated and controlled.
- [x] 4.3 Filter branch and terminal selector options according to backend-allowed data.
- [x] 4.4 Update menu/route/action helpers so `ADMIN` does not see or enter `/admin/peripherals` or `/configuracion`.
- [x] 4.5 Show allowed caja, orders, customers and inventory actions for `USER`, `ADMIN` and `SUPER_USER`.

## 5. Database Permissions

- [x] 5.1 Compare required role actions against real DB/menu permission conventions.
- [x] 5.2 Add idempotent SQL under `scripts/database/security/` if missing permissions are required.
- [x] 5.3 Update database runbook or evidence for any new SQL and confirm production was not touched.

## 6. Tests and Evidence

- [x] 6.1 Add backend tests for orders permissions and branch/tenant denial.
- [x] 6.2 Add backend tests for electronic-invoicing customer permissions and scope denial.
- [x] 6.3 Add backend tests for cash session open/close permissions and branch denial.
- [x] 6.4 Add backend tests for roles listing behavior by role.
- [x] 6.5 Add backend tests or documented coverage for terminal/context filtering.
- [x] 6.6 Create `docs/evidencia-mejora-contexto-operativo-perfiles.md` with QA matrix and execution results.

## 7. Validation

- [x] 7.1 Run `openspec validate mejora-contexto-operativo-perfiles --strict`.
- [x] 7.2 Run `openspec validate --all --strict`.
- [x] 7.3 Run `git diff --check`.
- [x] 7.4 Run backend build and focused backend tests.
- [x] 7.5 Run frontend lint/build.
- [x] 7.6 Record warnings, risks and final PASS/PASS CON OBSERVACIONES/FAIL state.
