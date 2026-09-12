# Gestión Operativa — Phase 5.12

## Result

Implemented a reusable real PostgreSQL Billing aggregate fixture. It uses
actual repositories and `ElectronicBillingProcessingService`; only the
external provider is replaced with a persistent deterministic test double.

## Fixture

- `backend-facturacion-electronica/test/helpers/real-billing-aggregate-fixture.ts`
- `backend-facturacion-electronica/test/electronic-billing.full-service.fixture.integration.spec.ts`
- Real local PostgreSQL: `localhost:55432`, database
  `manus_billing_concurrency_test`.
- Schema bootstrap applies the local Billing layers through `V076`.
- Fixture creates isolated tenant, provider, configuration, electronic
  document, lines, taxes, and events, then cleans only its deterministic rows.
- Supported initial stages: `PRE_PROVIDER_CREATE`, `PROVIDER_CREATE_INTENT`,
  `PROVIDER_LINKED`, `PRE_TRANSMIT`, `TRANSMISSION_INTENT`, and
  `RECONCILIATION_REQUIRED`.

## Provider double

`PersistentBillingProviderMock` retains provider documents by external
reference across service calls and exposes `createCalls` and `statusCalls`.
It performs no live HTTP, FactuCore, or DIAN operation.

## Smoke evidence

- `PRE_PROVIDER_CREATE` through the real processing service: `PASS`.
- State reloaded from PostgreSQL: `PASS`.
- Provider linkage and `COMPLETED` stage persisted: `PASS`.
- Repeated processing did not create a second provider document: `PASS`.
- `PROVIDER_LINKED` reconciliation through the real service: `PASS`.
- Real advisory-lock regression suite: `5/5 PASS`.
- Fixture smoke repetitions: `5`; failures: `0`; assertions: `10/10 PASS`.
- Full Billing suite: `159/159 PASS`.

## Scope and remaining work

This phase adds the aggregate fixture and smoke coverage. It does not certify
crash injection, stale recovery, ambiguous transmission, or expose retry API
or UI. Those remain Phase 5.13 work.

No QA or production database was changed. No live FactuCore or DIAN call was
made. No commit, push, or deploy was performed.
