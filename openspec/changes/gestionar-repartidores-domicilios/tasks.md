## 1. Discovery

- [x] 1.1 Review current delivery assignment model, DTOs, list/detail queries, and frontend display.
- [x] 1.2 Review API module/controller patterns for small tenant-scoped catalogs.
- [x] 1.3 Decide whether menu/permission changes are needed or delivery permissions can be reused.

## 2. Database

- [x] 2.1 Add additive migration for `delivery_drivers`.
- [x] 2.2 Add additive `deliveries.driver_id` column, foreign key, and indexes.
- [x] 2.3 Confirm migration contains no destructive SQL.

## 3. Backend

- [x] 3.1 Add delivery driver DTOs, service, controller, and module wiring.
- [x] 3.2 Implement `GET /api/delivery-drivers`, `POST /api/delivery-drivers`, `GET /api/delivery-drivers/:id`, `PATCH /api/delivery-drivers/:id`, and deactivate endpoint.
- [x] 3.3 Enforce tenant isolation and active-driver rules.
- [x] 3.4 Add `POST /api/deliveries/:id/assign-driver` with `{ driver_id }` or `{ driver_id: null }`.
- [x] 3.5 Add delivery list filtering by `driver_id`.
- [x] 3.6 Include assigned driver reference in delivery list/detail responses.
- [x] 3.7 Ensure driver assignment does not mutate delivery status, cash, payment, POS, fiscal, or inventory state.
- [x] 3.8 Add focused backend tests for CRUD, tenant isolation, assignment, inactive rejection, cross-tenant rejection, and unchanged status.

## 4. Frontend

- [x] 4.1 Add frontend delivery driver types and services.
- [x] 4.2 Add `/{tenant}/deliveries/drivers` screen with list, create, edit, and deactivate.
- [x] 4.3 Add "Repartidores" entry point from the deliveries screen.
- [x] 4.4 Show driver in delivery list and detail.
- [x] 4.5 Add driver filter to delivery list.
- [x] 4.6 Add assign/change/clear driver UI from delivery detail or actions.
- [x] 4.7 Add focused frontend helper/service tests if new helpers are added.

## 5. QA and Validation

- [x] 5.1 Create `docs/evidencia-qa-repartidores-domicilios.md`.
- [x] 5.2 Run `openspec.cmd validate gestionar-repartidores-domicilios --type change --strict`.
- [x] 5.3 Run `openspec.cmd validate --all --strict`.
- [x] 5.4 Run focused backend tests.
- [x] 5.5 Run `cd api && npm.cmd run build`.
- [x] 5.6 Run focused frontend tests if applicable.
- [x] 5.7 Run `cd web && npm.cmd run lint`.
- [x] 5.8 Run `cd web && npm.cmd run build`.
- [x] 5.9 Run `git diff --check`.
