## Why

The current customer and supplier audit identifies incomplete fiscal profiles, but operators have no supported Manus workflow to review and complete them. This change turns that queue into an auditable administrative flow with controlled Colombian domain values while preserving the final-consumer exception and fail-closed electronic billing.

## What Changes

- Add a tenant-scoped customer/supplier fiscal review queue backed by the same completeness rules as the existing audit.
- Add filters, missing-field reasons, and links into the existing customer and supplier edit flows.
- Replace free-text fiscal selections with controlled person-type, tax-regime, and responsibility options supported by the current domain.
- Keep geographic selection cascading and server-side canonical; never mass-assign fiscal values or default `R-99-PN`.
- Record human fiscal edits as `MANUAL` without asserting DIAN validation.
- Preserve incomplete-profile billing rejection and the final-consumer `NOT_REQUIRED` exception.

## Capabilities

### New Capabilities

- `fiscal-profile-review`: tenant-scoped review queue and controlled fiscal profile maintenance for customers and suppliers.

### Modified Capabilities

No existing OpenSpec capability is modified. The queue exposes the already-certified fiscal completeness policy through a new administrative capability.

## Impact

- API electronic-invoicing customer/supplier services and a new read-only review endpoint.
- Web customer/supplier forms and a new fiscal review page.
- Existing customer/supplier menu permissions; no new permission or migration is required.
- OpenSpec documentation and focused API/domain tests. No FactuCore, DIAN, outbox, or electronic-document processing changes.
