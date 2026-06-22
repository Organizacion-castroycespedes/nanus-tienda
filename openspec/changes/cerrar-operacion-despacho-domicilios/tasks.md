## 1. Discovery

- [x] 1.1 Review backend-reporteria ticket/PDF patterns.
- [x] 1.2 Review delivery create DTO/service and assign-driver validation.
- [x] 1.3 Review frontend delivery form, list/detail actions, and report PDF preview pattern.

## 2. Backend API

- [x] 2.1 Add optional `driver_id` to delivery create DTOs.
- [x] 2.2 Validate active same-tenant driver during delivery creation.
- [x] 2.3 Save `driver_id` on create without changing delivery status.
- [x] 2.4 Add focused API tests for create-with-driver and unchanged status.

## 3. Backend Reporteria

- [x] 3.1 Add delivery ticket dataset types.
- [x] 3.2 Add delivery report adapter with tenant/branch-scoped read-only query.
- [x] 3.3 Add delivery ticket service/controller route.
- [x] 3.4 Add thermal delivery ticket template.
- [x] 3.5 Wire controller/service/adapter into reports module.
- [x] 3.6 Add focused backend-reporteria tests.

## 4. Frontend

- [x] 4.1 Add `driver_id` to create payload mapping and tests.
- [x] 4.2 Add active driver selector to `CreateDeliveryForm`.
- [x] 4.3 Make assign/change/clear driver actions clearer in list/detail.
- [x] 4.4 Add delivery ticket blob service.
- [x] 4.5 Add delivery ticket preview/download/print action using `PdfPreviewModal`.
- [x] 4.6 Add focused frontend tests where helpers/services changed.

## 5. QA and Validation

- [x] 5.1 Create `docs/evidencia-qa-operacion-despacho-domicilios.md`.
- [x] 5.2 Run `openspec.cmd validate cerrar-operacion-despacho-domicilios --type change --strict`.
- [x] 5.3 Run `openspec.cmd validate --all --strict`.
- [x] 5.4 Run API focused tests and build.
- [x] 5.5 Run backend-reporteria focused tests and build.
- [x] 5.6 Run web focused tests, lint, and build.
- [x] 5.7 Run `git diff --check`.
