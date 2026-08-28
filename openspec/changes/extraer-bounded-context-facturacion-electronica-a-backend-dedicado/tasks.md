## 1. Architecture boundary

- [x] 1.1 Define and validate the extraction boundary between `api/` and `backend-facturacion-electronica/`.
- [x] 1.2 Freeze the integration event envelope for sale completed events.
- [x] 1.3 Document ownership of `electronic_*` tables, worker runtime, and provider lifecycle.

## 2. Backend foundation

- [x] 2.1 Add database foundation to `backend-facturacion-electronica/` using PostgreSQL and SQL direct access.
- [x] 2.2 Add backend runtime config for DB connection and shared environment handling.
- [x] 2.3 Add a reusable database service/pool boundary for repositories.
- [x] 2.4 Prepare target module structure for billing bounded context.

## 3. Integration contract

- [x] 3.1 Create the `SaleCompletedForElectronicBilling` integration event contract.
- [x] 3.2 Define event versioning, correlation, tenant identity, and source envelope.
- [x] 3.3 Specify idempotent consumer behavior and at-least-once delivery semantics.

## 4. Outbox and cutover plan

- [x] 4.1 Specify transactional outbox ownership in API.
- [x] 4.2 Define the cutover rule that prevents dual worker ownership.
- [x] 4.3 Define the extraction sequence X3-X10 at architecture level.

## 5. OpenSpec and evidence

- [x] 5.1 Add architecture evidence for the extraction plan and target module graph.
- [x] 5.2 Validate OpenSpec artifacts for the new architectural change.

## 6. X3 pure contracts and provider abstractions

- [x] 6.1 Copy canonical provider commands and pure domain types to `backend-facturacion-electronica/`.
- [x] 6.2 Copy `ElectronicBillingProvider`, provider registry, fake provider, and neutral provider errors to `backend-facturacion-electronica/`.
- [x] 6.3 Defer repository-shaped record types and repository-dependent provider resolver to X4.
- [x] 6.4 Document overlap between the new canonical provider abstraction and the existing legacy DIAN/fiscal scaffolding.
- [x] 6.5 Validate backend build/tests and keep API runtime untouched.

## 7. X4 repositories and application services

- [x] 7.1 Copy persistence-shaped record types for electronic billing to `backend-facturacion-electronica/`.
- [x] 7.2 Copy repository implementations and keep transaction-compatible PoolClient support.
- [x] 7.3 Move repository-dependent provider resolver to `backend-facturacion-electronica/`.
- [x] 7.4 Move `ElectronicBillingService` and `ElectronicBillingProcessingService` to `backend-facturacion-electronica/`.
- [x] 7.5 Keep API runtime source retained during transition and validate backend/API build and tests.

## 8. X5 FactuCore adapter and background worker

- [x] 8.1 Copy/adapt the FactuCore client, mapper, provider, errors, types, and bootstrap into `backend-facturacion-electronica/`.
- [x] 8.2 Copy/adapt `ElectronicBillingBackgroundService` into `backend-facturacion-electronica/` with default-disabled execution.
- [x] 8.3 Keep API runtime as the productive owner and avoid cutover.
- [x] 8.4 Validate backend/API build, tests, OpenSpec, and leak scans after the move.

## 9. X6 integration event consumer and transactional inbox

- [x] 9.1 Define the durable transactional inbox for sale billing events.
- [x] 9.2 Add the sale completed integration event consumer in `backend-facturacion-electronica/`.
- [x] 9.3 Add the internal intake boundary for the sale billing event.
- [x] 9.4 Map the sale snapshot to `IssueElectronicInvoiceCommand` without rereading API tables.
- [x] 9.5 Validate consumer idempotency, tenant isolation, and backend/API build and tests.

## 10. X7 transactional outbox in API

- [x] 10.1 Add the reusable integration outbox module and repository in `api/`.
- [x] 10.2 Add the internal billing client and dispatcher with lease-based claiming.
- [x] 10.3 Add the V074 official migration for `integration_outbox_events`.
- [x] 10.4 Add contract compatibility tests against the X6 billing event envelope.
- [x] 10.5 Validate API/backend build and tests with the outbox foundation in place.
