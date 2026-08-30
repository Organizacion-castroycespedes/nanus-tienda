# Design: extraer bounded context de facturacion electronica a backend dedicado

## Current

```text
SaleService
  -> SaleElectronicInvoiceMapper
  -> ElectronicBillingService
  -> repositories
  -> providers
  -> FactuCore
  -> background processing
```

API hoy conoce demasiado:

- `ElectronicBillingService`
- `ElectronicBillingProcessingService`
- `ElectronicBillingProvider`
- `FactuCore*`
- `electronic_*` repositories

The current API implementation still owns the live runtime. This phase only copies pure contracts and provider abstractions to the billing backend target.

## Target

```text
SaleService
  -> durable integration event / outbox
  -> commit

Billing Backend
  -> event consumer
  -> billing mapper
  -> ElectronicBillingService
  -> repositories
  -> provider abstraction
  -> FactuCore
  -> background worker

## Provider abstraction overlap

Canonical abstraction for the electronic billing bounded context:

- `ElectronicBillingProvider`
- `ElectronicBillingProviderRegistry`
- `FakeElectronicBillingProvider`
- neutral provider errors and commands

Legacy backend fiscal scaffolding remains separate for now:

- `modules/providers/*`
- `FiscalProviderAdapter`
- `DIAN` helpers

Decision:

- keep both temporarily
- do not auto-register legacy DIAN providers in the electronic billing module
- defer provider-resolver logic that depends on repositories to X4
```

## Ownership matrix

| Capability | API | Billing Backend |
| --- | --- | --- |
| Sales | OWNER | NO |
| Returns | OWNER | NO |
| Orders | OWNER | NO |
| Inventory | OWNER | NO |
| Payments | OWNER | NO |
| Outbox / integration event | OWNER | NO |
| Integration event consumer | NO | OWNER |
| Electronic documents | NO | OWNER |
| Electronic lines | NO | OWNER |
| Electronic taxes | NO | OWNER |
| Electronic references | NO | OWNER |
| Electronic events | NO | OWNER |
| Attachments | NO | OWNER |
| Deliveries | NO | OWNER |
| Provider config | NO | OWNER |
| Provider abstraction | NO | OWNER |
| FactuCore adapter | NO | OWNER |
| Status sync / retry / recovery | NO | OWNER |
| Background worker | NO | OWNER |
| Credentials | NO | OWNER |

## Database strategy

Initial strategy:

```text
shared PostgreSQL database
```

Logical ownership is separated even if the physical database remains shared.

API owns:

- sales tables
- order tables
- inventory tables
- payments tables
- outbox tables

Billing backend owns:

- `electronic_*` tables

## Integration contract

The API must not send internal billing commands directly.
It must emit a stable integration event:

```text
SaleCompletedForElectronicBilling
```

Suggested envelope:

```text
eventId
eventType
schemaVersion
tenantId
correlationId
occurredAt
source:
  type
  id
payload
```

Payload must contain enough sale snapshot to build canonical billing commands later, without rereading API domain tables.

## Outbox

API writes the sale and the outbox event in the same PostgreSQL transaction.
Delivery is at-least-once.
Billing backend consumer must be idempotent.

X7 adds an API `IntegrationOutboxModule` with:

- reusable outbox repository
- internal billing client
- dispatcher with lease-based claiming
- default-disabled runtime

The API still keeps the direct billing hook until X8. X7 only prepares the durable producer side and the internal delivery boundary.

No HTTP call to billing backend is allowed inside the sale transaction.

## Inbox

Billing backend consumes the event through a transactional inbox.
The inbox is durable and unique by `eventId` and sale source identity.
The consumer creates the internal electronic document inside one backend transaction, then marks the inbox row as processed.

The consumer does not reread API sales tables. It only uses the event snapshot.

## Cutover

Only one runtime may own the billing worker in a given environment.

Cutover order:

1. API emits outbox event.
2. Billing backend consumer is ready.
3. API billing worker is disabled.
4. Billing backend worker is enabled.

This avoids dual processing.

## Credential resolution

Selected secret backend for the initial extraction:

```text
environment-based secret resolution
```

Reason:

- no AWS Secrets Manager, Vault, SSM, or other managed secret backend was found in the repo
- the platform already uses `process.env` for runtime config
- the billing backend can keep `credential_reference` in the database while secret material stays in runtime env

Credential flow:

```text
tenant_electronic_billing_configs.credential_reference
  -> env:<REFERENCE>
  -> env variable JSON payload
  -> provider-neutral resolved credential
  -> FactuCore-specific validation
  -> runtime request headers
```

Rules:

- the database stores only `credential_reference`
- secret values are not stored in DB rows, events, inbox, outbox, logs, or metadata
- the credential resolver is owned by `backend-facturacion-electronica`
- `FactuCoreClient` does not read `process.env`
- resolved credentials are operation-scoped and never cached in shared mutable singleton state
- provider-specific validation stays inside the FactuCore adapter

Operational limit:

- the env-backed strategy is acceptable for the first controlled rollout
- it is not the long-term ideal for large tenant-scale secret rotation
- later swaps can move the same resolver contract to a managed secret backend without changing the billing domain contract

## Backend foundation

`backend-facturacion-electronica/` should get:

- Postgres config
- database service / pool
- repository layer
- runtime config for shared DB
- module structure for billing bounded context

It does not receive the billing domain move yet in X2.

## Internal transport

The future API-to-billing handoff uses a stable integration event envelope.
The billing backend exposes an internal endpoint for event intake, authenticated with the internal service token pattern already used elsewhere in the repo.

## X3 split rule

Only pure, repository-free, provider-neutral types move in X3.

Types that are shaped by PostgreSQL rows remain in API for transition and are deferred to X4:

- `electronic-billing-records.ts`
- repository query-shape interfaces

Provider resolver stays deferred because it depends on repositories.

## X4 target paths

X4 moved the persistence and application layer into the billing backend under:

- `backend-facturacion-electronica/src/modules/electronic-billing/repositories/`
- `backend-facturacion-electronica/src/modules/electronic-billing/services/`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/electronic-billing-provider-resolver.ts`

The API keeps its source files during transition so the live sale flow remains green until cutover.

## X5 target paths

X5 moved the FactuCore adapter and background worker implementation into the billing backend under:

- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/`
- `backend-facturacion-electronica/src/modules/electronic-billing/workers/`

The worker is registered but defaults to disabled until a later cutover phase. The API remains the productive runtime owner for now.
