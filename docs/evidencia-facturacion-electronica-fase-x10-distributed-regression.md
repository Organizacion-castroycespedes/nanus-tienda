# Evidencia FASE X10 - Distributed Architecture Regression + Pre-Cutover Validation

## Architecture chain

- API `SaleService`
- API integration outbox builder
- API `integration_outbox_events`
- API outbox dispatcher
- internal HTTP client
- Billing Backend controller
- Billing Backend transactional inbox
- Billing Backend consumer
- Billing Backend `IssueElectronicInvoiceCommand`
- Billing Backend `ElectronicBillingService`
- Billing Backend repositories
- Billing Backend processing and background worker

## Contract parity

- Event type: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`
- Schema version: `1`
- Source: `SALE`
- Stable fields validated in fixture:
  - `eventId`
  - `tenantId`
  - `correlationId`
  - `occurredAt`
  - `source.id`
  - `payload.sale`
  - `payload.customer`
  - `payload.lines`
  - `payload.taxes`
  - `payload.payments`
  - `payload.totals`
  - `payload.currencyCode`

## Golden event

- Fixture file: `backend-facturacion-electronica/test/fixtures/sale-completed-for-electronic-billing.v1.json`
- Shape matches API serialized v1 contract.
- Fixture includes weighted product, excluded line, mixed payments, and flat customer snapshot.

## Precision and totals

- Decimal wire format stays string.
- Totals check passes on:
  - subtotal `6200.00`
  - tax `950.00`
  - total `7150.00`

## Idempotency

- Producer idempotency by `eventId`.
- Business idempotency by `tenantId + source.type + source.id`.
- Billing external reference stays deterministic:
  - `SALE-${tenantId}-${saleId}`

## Transport failures

- Outbox remains durable on dispatcher failure.
- Billing consumer returns idempotent result on replay.
- No real HTTP used in X10.

## Inbox atomicity

- Billing inbox consumes event before provider work.
- Consumer creates `electronic_document` in `PENDING`.
- Provider HTTP not called in X10.

## Processing handoff

- `ElectronicBillingProcessingService` and worker remain in Billing Backend.
- Worker stays disabled by default.

## Legacy documents

- Shared PostgreSQL schema keeps existing `electronic_*` rows compatible.
- No data migration required in X10.

## Ownership scans

- API no longer carries production billing runtime.
- Billing Backend owns `electronic_*`, inbox, provider lifecycle, and processing.
- API owns outbox and dispatcher.

## Migration audit

- `V072__electronic_billing_base_persistence.sql`: static pass
- `V073__electronic_billing_inbox_events.sql`: static pass
- `V074__integration_outbox_events.sql`: static pass
- No migration applied in X10

## Runtime flags

- API outbox dispatcher: disabled by default
- Billing worker: disabled by default

## Remaining blockers

- `V073` real PostgreSQL validation: pending
- `V074` real PostgreSQL validation: pending
- Credential storage: pending
- Real FactuCore E2E: blocked
