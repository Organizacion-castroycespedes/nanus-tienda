# Proposal: integrar-facturacion-electronica-multiproveedor

## Why

Manus needs electronic billing, but it cannot bind the sales domain to FactuCore. The current codebase is already multi-tenant, uses PostgreSQL directly, and has only partial fiscal scaffolding, while the real FactuCore runtime shows a provider-specific invoice pipeline. We need a neutral contract first so future providers can be added without touching `SaleService`, `ReturnService`, or the main POS UI.

## What Changes

- Define a provider-independent electronic billing domain in Manus.
- Add neutral persistence concepts for providers, tenant provider configuration, electronic documents, document lines, taxes, references, events, attachments, and deliveries.
- Support `INVOICE`, `CREDIT_NOTE`, and `DEBIT_NOTE` as document types from the start.
- Keep FactuCore behind a dedicated provider adapter boundary.
- Define neutral internal statuses and provider-status mapping.
- Define local idempotency and multitenant isolation rules.
- Separate fiscal document state from customer delivery state.
- Add a future-proof path for multiple providers per tenant.
- **BREAKING**: no runtime contract is changed yet; the breaking part is only the future schema boundary if the current sales flow had been coupled directly to a vendor.

## Capabilities

### New Capabilities

- `provider-abstraction`: Provider interface and capability boundary for multiple electronic billing vendors.
- `provider-configuration`: Tenant-level provider selection, environment, and secret reference model.
- `electronic-document-model`: Neutral document header model for invoices, credit notes, debit notes, and source tracking.
- `invoice-issuing`: Provider-independent invoice issuance requirement and optional enablement.
- `credit-note-support`: Credit note model, origin linkage, and multiple-note traceability.
- `status-mapping`: Internal status model and vendor status normalization.
- `idempotency`: Duplicate prevention rules for document creation and retries.
- `document-references`: Reference model for origin documents, external references, and future document chains.
- `document-line-traceability`: Line snapshots, provider line references, and fiscal tax history.
- `audit-events`: Technical lifecycle events without secret leakage.
- `attachments`: XML, signed XML, PDF, and provider-response attachment tracking.
- `email-delivery`: Delivery tracking separated from fiscal acceptance.
- `multitenant-isolation`: Tenant-safe storage and access rules across the electronic billing domain.

### Modified Capabilities
<!-- None. This change introduces new capabilities only. -->

## Impact

- `api/` domain modeling and future NestJS modules.
- PostgreSQL schema design and migration planning.
- OpenSpec planning artifacts for the new billing bounded context.
- Existing `inventory`, `sales`, `returns`, `customers`, `suppliers`, `finance`, and POS flows only as source systems, not as vendor-coupled targets.
- Future FactuCore integration code under a dedicated adapter boundary.
