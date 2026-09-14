## Context

Manus stores issuer fiscal data in `public.tenants_detalles`. FactuCore resolves the issuer from its own tenant configuration. Its `dian-ubl-readiness.service.ts:isTenantNotResponsibleForVat()` currently infers non-responsibility from `R-99-PN` or `ZZ` and has no explicit VAT field.

## Decision

Add `vat_responsibility` to `tenants_detalles` with default `UNKNOWN` and a check constraint. The protected existing `CONFIG_GENERAL` write path remains the maintenance boundary. The Web form uses a “Responsabilidad de IVA” select.

The sale billing event adds `issuerVatResponsibility` to its payload. It does not replace DIAN responsibilities or create a fabricated FactuCore code. IVA-bearing intents fail closed unless the issuer is explicitly `RESPONSIBLE`; no-tax sales keep current behavior.

## Compatibility and safety

- Legacy rows are `UNKNOWN`; no inference from `R-99-PN`.
- No customer/supplier columns: current FactuCore has no explicit customer VAT-responsibility field and the readiness rule is issuer-focused.
- No FactuCore source/provider change and no existing document/event mutation.
- V079 is additive and non-destructive.
