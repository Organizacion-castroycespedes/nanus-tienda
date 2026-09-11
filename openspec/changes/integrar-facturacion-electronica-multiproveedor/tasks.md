## 1. Foundation

- [x] 1.1 Confirm the `public.electronic_*` table naming and constraint strategy for provider, config, document, line, tax, reference, event, attachment, and delivery records.
- [x] 1.2 Define the tenant secret-reference mechanism and the allowed environment values for provider configuration.
- [x] 1.3 Freeze the internal status model, provider status mapping, and idempotency key rules before any migration work starts.

## 2. Persistence model

- [x] 2.1 Add database migrations for provider and tenant configuration tables with unique provider code and tenant-safe defaults.
- [x] 2.2 Add database migrations for electronic document, line, tax, reference, event, attachment, and delivery tables.
- [x] 2.3 Add indexes and constraints for tenant isolation, idempotency, source lookup, status queries, and reference integrity.
- [x] 2.4 Normalize the phase 2 electronic billing migration into the official Manus runner under `scripts/database/migrations/` and retire the manual `api/database` source.

## 3. Domain model and boundaries

- [x] 3.1 Add provider-neutral entities, DTOs, and repositories for the electronic billing domain.
- [x] 3.2 Add the provider adapter interface and canonical command/result contracts.
- [x] 3.3 Keep sales and returns as source systems only, with no vendor-specific fields in their core models.

## 4. FactuCore adapter

- [x] 4.1 Implement the FactuCore provider adapter boundary without exposing vendor choreography to Manus callers.
- [x] 4.2 Add FactuCore request mappers for invoice, credit note, and status retrieval flows.
- [x] 4.3 Add safe handling for attachments, provider status normalization, and retry results.

## 5. Runtime integration and QA

  - [x] 5.1 Wire the electronic billing service into the tenant-aware application flow with optional enablement.
- [x] 5.2 Add tests for idempotency, multitenant isolation, credit note lineage, and status mapping.
- [x] 5.3 Validate the OpenSpec artifacts and prepare the phase 2 migration plan before any productive change lands.
- [x] 5.4 Implement the transactional electronic billing application service and aggregate creation boundary.

## 6. Provider processing orchestration

- [x] 6.1 Add a processing service that claims documents, resolves the tenant provider, invokes the provider, and persists provider results.
- [x] 6.2 Add status refresh and retry orchestration with safe error classification and no database transaction held during HTTP.
- [x] 6.3 Add tests for processing claim, provider result persistence, refresh, retry, credit note lineage, and provider error handling.
- [x] 6.4 Document the phase 6 implementation evidence and QA outcomes.
