## Context

Manus runs on NestJS in `api/` with PostgreSQL, SQL-first repositories, UUID primary keys, `TIMESTAMPTZ` timestamps, and `JSONB` for metadata-heavy tables. The current schema style is `public`-only. Existing operational models already isolate tenants through `tenant_id` and keep sales, orders, customers, suppliers, finance, and inventory in the core app.

There is already a partial `api/src/modules/electronic-invoicing` module, but it is customer/supplier lookup and DIAN catalog oriented. It is not a provider-independent document domain. The real FactuCore runtime shows the opposite side of the problem: a mature document pipeline with multi-step issuance, external API auth, idempotency, attachments, events, and document references. Manus needs the neutral boundary first.

## Goals / Non-Goals

**Goals:**

- Define a provider-independent electronic billing domain.
- Keep sales and returns free from vendor-specific fields.
- Support FactuCore first, but make another provider possible without rewriting the sales flow.
- Define neutral database entities for providers, tenant configuration, documents, lines, taxes, references, events, attachments, and deliveries.
- Preserve optional enablement per tenant.
- Keep fiscal document status separate from customer delivery status.

**Non-Goals:**

- No HTTP integration with FactuCore yet.
- No productive migrations yet.
- No change to `SaleService`, `ReturnService`, or POS UI behavior in this phase.
- No vendor-specific XML/signing/transmission logic in this phase.
- No decision on binary attachment storage implementation yet.

## Decisions

### 1) PostgreSQL strategy: public schema with prefixed tables

**Option A**

Use a dedicated schema like `electronic_billing.*`.

**Pros**
- Strong namespace separation.
- Clear boundary for a future isolated subsystem.
- Easier to grant schema-level permissions later.

**Cons**
- Manus does not currently use named schemas in its main application schema design.
- Adds migration and tooling complexity without matching the current repo pattern.
- Increases friction for existing SQL-first code and manual scripts.

**Option B**

Keep the current pattern and create prefixed tables in `public`, such as `public.electronic_billing_providers`, `public.electronic_documents`, and child tables.

**Pros**
- Matches current Manus architecture and migration style.
- Keeps operations simple for the existing SQL-first backend.
- Avoids introducing a second schema strategy just for one bounded context.

**Cons**
- Less namespace isolation than a dedicated schema.
- Table names must be disciplined and consistent.
- Future schema split would require a migration later.

**Recommendation**

Use **Option B**. Manus already behaves like a `public`-schema application. The cleanest phase-1 boundary is table prefixing, not a new schema namespace. That keeps the design faithful to the current architecture and reduces early migration risk.

### 2) Domain boundary

Create a dedicated electronic billing bounded context. The sales domain only emits source data. The billing domain owns provider selection, idempotency, document lifecycle, and fiscal attachments.

Alternative considered: add FactuCore fields directly to sales and returns. Rejected. That would couple the core POS to one vendor and violate the future-provider requirement.

### 3) Provider abstraction

Define a provider interface that can support both multi-step flows and one-call vendors.

FactuCore is a multi-step provider in practice: create or validate document, generate XML, sign, transmit, refresh status, and download artifacts.

Another vendor may do `POST /invoice` once. The interface must hide that difference behind the adapter.

Alternative considered: expose FactuCore steps to the rest of Manus. Rejected. Sales should not know vendor choreography.

### 4) Document identity and idempotency

Use `tenant_id + provider_id + document_type + external_reference` as the core idempotency boundary.

`external_reference` remains the business key from Manus. `provider_document_id` is vendor-generated and must not be used as the local uniqueness key.

Alternative considered: idempotency on vendor document id alone. Rejected. That arrives too late in the flow and cannot protect local retries.

### 5) Status model

Keep `status` and `provider_status` separate.

- `status` is Manus internal lifecycle.
- `provider_status` is the raw or normalized vendor state.

This lets one provider have many technical states while Manus shows one stable operational state.

### 6) Attachments and delivery

Store attachments as references to storage, not as binary blobs in PostgreSQL by default. Track email delivery separately from fiscal success.

Alternative considered: store XML/PDF binaries directly in the document row. Rejected. That makes rows wide and mixes lifecycle with payload storage.

### 7) Tenant configuration secrets

Store only secret references or backend-resolved credentials, not raw secrets in the domain tables.

Alternative considered: plain-text credentials in configuration rows. Rejected for obvious reasons.

## Risks / Trade-offs

- [Risk] The current Manus `electronic-invoicing` module may be mistaken for the final billing domain → [Mitigation] Keep the new bounded context neutral and treat the current module as lookup scaffolding only.
- [Risk] A prefixed `public` model may become crowded → [Mitigation] Use strict table naming and child-table grouping from the start.
- [Risk] Future providers may need different lifecycle steps → [Mitigation] Use the adapter boundary and do not leak vendor steps into sales or UI contracts.
- [Risk] Credit note traceability can become ambiguous → [Mitigation] Persist origin document and origin line references as first-class entities.
- [Risk] Delivery state gets confused with fiscal acceptance → [Mitigation] Separate `electronic_document_deliveries` from document status.
- [Risk] Idempotency collisions may reject valid replays → [Mitigation] Include provider and document type in the unique boundary and keep retry semantics explicit.

## Migration Plan

1. Finalize OpenSpec proposal, specs, and design.
2. Add database migrations in phase 2 for provider, configuration, document, line, tax, reference, event, attachment, and delivery tables under `scripts/database/migrations/`.
3. Add repository and service boundaries in phase 3.
4. Add FactuCore adapter and mapping in later phases.
5. Integrate invoice flow, then credit note flow, then status sync.
6. Keep POS and returns untouched until the adapter boundary is stable.

Rollback for phase 1 is simple: remove or revise the planning artifacts before any migration lands. No production code changes are made in this phase.

## Open Questions

- Should tenant provider configuration allow more than one active provider at once, or only one active default with inactive alternates?
- Which existing Manus secret storage mechanism should be reused, if any, for credential references?
- Should attachments eventually move to object storage or remain database-backed references only?
- Should status mapping be persisted as a table or remain adapter code until phase 2?
- Should email delivery be part of the first runtime phase or stay modeled only until the document pipeline exists?

## ERD

```text
electronic_billing_providers
  -> tenant_electronic_billing_configs
      -> electronic_documents
          -> electronic_document_lines
              -> electronic_document_taxes
          -> electronic_document_references
          -> electronic_document_events
          -> electronic_document_attachments
          -> electronic_document_deliveries

electronic_documents
  -> source document in sales / returns / orders / manual
  -> provider-neutral document identity
  -> internal status + provider status
```

## Impact on Current Tables

- `sales`: no change required in phase 1; it remains a source table only.
- `sale_details`: no change required in phase 1; line snapshots will read from it later.
- `returns`: no change required in phase 1; it will become a source for credit notes later.
- `return_details`: no change required in phase 1; it will feed credit note line snapshots later.
- `customers`: no change required in phase 1; customer lookup remains operationally separate.
- `tenants`: no structural change required in phase 1; tenant scope is inherited by the billing domain.

## Schema Recommendation Summary

**Recommendation:** `public.electronic_*` tables.

**Why:** It matches the current Manus persistence model, avoids inventing a second schema convention, and keeps the first implementation aligned with the real codebase.

## Canonical fiscal snapshot addendum

The `SALE_COMPLETED_FOR_ELECTRONIC_BILLING` version 1 event already carries the
provider-neutral `customer`, `lines`, `lines[].taxes`, `taxes`, `payments`, and
`totals` fields. The compatible decision is to keep schema version 1.

The API sale producer remains the owner of the fiscal snapshot. It resolves the
customer and sale-item tax data inside the sale transaction and writes them to
the outbox event. The billing backend consumes only that event; it does not read
API-owned sales, customers, or tax tables.

An explicit zero-rate tax classification is preserved when a sale item has a
tax identity or rate, even when its amount is zero (for example, `Exento`). A
genuinely tax-free item without tax identity remains tax-free. The billing
aggregate persists the customer snapshot in document metadata and line taxes in
`electronic_document_taxes`.

For the historical QA candidate, the immutable inbox payload contains customer
data but no line/document tax rows; the persisted document was created without
the current customer metadata. No historical row is patched. Recommended
recovery is a new controlled QA sale after this boundary fix.
## Controlled QA DI and retry finding

The local Nest runtime initially registered `FactuCoreClient`, but constructor metadata did not provide that token to `FactuCoreProvider`. The provider therefore held an undefined client while unit tests still passed because provider tests supplied manual mocks. The fix uses explicit `@Inject(FactuCoreClient)` and `@Inject(FactuCoreMapper)` tokens and adds a real application-context regression test.

The controlled retry then exposed a separate state-machine gap: a `TECHNICAL_ERROR` created before any provider document has no provider ID, but `retryDocument()` calls the provider retry operation instead of restarting issue/create. FactuCore returned `404` for the external-reference status lookup. No provider mutation occurred. This document must not be retried again until the retry path is corrected.

The corrected state machine now uses external-reference reconciliation before pre-provider retry, preserves provider identity after partial create, and permits only the known legacy pre-provider `REJECTED` classification to recover. The controlled re-execution reached FactuCore `CREATE` once and received sanitized `400` validation; XML generation, signing, and transmission were not attempted.

## FactuCore create payload validation finding

The authoritative FactuCore source is `D:/Profe/Factucore`. Its invoice route
uses `CreateInvoiceDto` and global validation with `forbidNonWhitelisted`.
Manus previously emitted nested tax keys that are not part of the FactuCore tax
DTO, and emitted `Exento` taxes for excluded lines. The adapter now keeps those
identifiers in metadata, omits taxes for excluded lines, and maps generic `UNIT`
to `EA` for DIAN-compatible provider input. Billing regression coverage passes.

The final controlled retry still received a sanitized HTTP 400. No further
provider POST was attempted because the response body is not retained by the
current client error model. Provider QA remains blocked until the remaining
FactuCore validation field is identified without another uncontrolled retry.

## Provider validation observability

FactuCore validation responses use an envelope containing `statusCode`,
`message`, `code`, and `failedChecks`. Manus now preserves the provider code
and bounded validation `{ path, message }` details in
`FactuCoreValidationError`, while recursively excluding credential fields and
unnecessary payload data. HTTP 400/422 remains provider
validation and maps to `REJECTED`; transport, runtime, and configuration
failures remain `TECHNICAL_ERROR`.

The final diagnostic retry identified `lines.0.unitCode=UND` as the remaining
payload mismatch. FactuCore accepts `UNIT`, `NIU`, `EA`, `HOUR`, `DAY`,
`KILOGRAM`, `LITER`, and `SERVICE`; Manus now maps `UND` to `EA`. No second
provider retry was performed after this correction.

## FactuCore DIAN readiness finding

FactuCore accepts the external DTO shape, then `DocumentsService.createDocument`
calls `DianUblReadinessService.checkDocumentCandidate` before persistence. The
generic readiness error is raised when that result is not ready; the response
also carries its `missing` list.

An earlier readiness check incorrectly searched the FactuCore database with the
Manus QA tenant `00000000-0000-0000-0000-000000000001`. The configured Manus
credential's API client `60cbac48-f476-4f34-9664-6ba27df95d23` belongs to the
FactuCore tenant `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`, which has the required
issuer, DIAN tenant configuration, and invoice resolution. The actual issue was
tenant identity mismatch, not missing FactuCore fiscal configuration.

## Manus and FactuCore tenant identity alignment

Manus tenant identity and FactuCore tenant identity are separate bounded-context
identifiers. The provider configuration keeps the Manus tenant in
`tenant_id` and stores the external FactuCore tenant in provider settings under
`factuCoreTenantId`. This value is resolved only by the FactuCore adapter and is
not added to the provider-neutral sale event.

FactuCore external document requests resolve the effective tenant from the
authenticated API-client actor. The request `tenantId` does not override that
actor tenant for API-client calls. Therefore Manus does not send its tenant UUID
as a FactuCore tenant identity. The configured API client resolves to the
FactuCore tenant, whose issuer, DIAN configuration, invoice resolution, and
signing configuration are ready in TEST.

## Controlled E2E after tenant alignment

The aligned QA configuration resolved both bounded-context tenant identities and
the billing runtime resolved the FactuCore provider without provider-specific
data in the sale event. The single authorized recovery was invoked once for the
existing document. FactuCore timed out during the authenticated provider
preflight, and its health endpoint also timed out afterward. The recovery stopped
before invoice creation; no provider document or fiscal mutation was observed.
