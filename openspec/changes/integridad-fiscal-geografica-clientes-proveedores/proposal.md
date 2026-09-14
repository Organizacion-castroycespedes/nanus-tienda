## Why

Customers and suppliers can currently retain free-text or incomplete geographic and fiscal data. This makes new records unreliable and can produce incomplete electronic-billing snapshots. The change establishes one catalog-backed integrity path for both domains before further fiscal operations.

## What Changes

- Require catalog-backed country, department, and municipality selection for normal customer and supplier create/update flows.
- Persist canonical geographic IDs and codes while keeping compatible legacy labels.
- Validate fiscal profile fields according to existing domain rules without assigning guessed responsibilities.
- Add cascading Web selectors and hydrate them from persisted canonical values.
- Add read-only dry-run and guarded, idempotent QA backfill for deterministic geographic corrections.
- Classify unresolved historical fiscal data for review instead of mass-defaulting it.
- Make electronic-billing customer eligibility require canonical geographic and fiscal data.
- Preserve immutable fiscal snapshots, final-consumer policy, tenant isolation, and billing worker-disabled diagnostics.

## Capabilities

### New Capabilities

- `customer-fiscal-geography`: Catalog-backed customer geographic and fiscal integrity.
- `supplier-fiscal-geography`: Catalog-backed supplier geographic and fiscal integrity.
- `fiscal-data-backfill`: Auditable dry-run and deterministic idempotent backfill.
- `electronic-billing-fiscal-guard`: Fail-closed provider snapshot eligibility.

### Modified Capabilities

<!-- No existing OpenSpec capability has matching customer/supplier integrity requirements. -->

## Impact

- API customer, supplier, location, billing-snapshot, DTO, repository, and migration code.
- Web customer and supplier forms and geographic lookup selectors.
- Reference catalog foreign keys and indexes, if the existing schema requires them.
- Billing tests and contract fixtures that consume customer fiscal snapshots.
- QA-only backfill execution and evidence; no FactuCore, DIAN, or production mutation.
