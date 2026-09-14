## Why

Manus has no explicit IVA responsibility dimension. `R-99-PN` is a DIAN fiscal responsibility code, but FactuCore also treats it as “not responsible for IVA”, so the meanings are coupled and IVA invoices are blocked.

## What Changes

- Add controlled `vat_responsibility`: `RESPONSIBLE`, `NOT_RESPONSIBLE`, `UNKNOWN`.
- Store and maintain the issuer value in `tenants_detalles`, leaving legacy rows `UNKNOWN`.
- Expose it through the protected tenant details API and existing company configuration screen.
- Carry the state in sale billing event metadata for downstream contract evolution.
- Reject local IVA billing unless issuer responsibility is explicitly `RESPONSIBLE`; preserve no-tax behavior.
- Document the current FactuCore mismatch. No FactuCore source or QA mutation belongs here.

## Capabilities

### New Capabilities

- `iva-responsibility`: Explicit controlled VAT responsibility for issuer configuration and billing eligibility.

### Modified Capabilities

- `electronic-billing`: IVA-bearing sale intents require explicit issuer VAT responsibility.

## Impact

API tenant details, integration-outbox event contract, Web company configuration, additive migration after V078, and focused tests/docs.
