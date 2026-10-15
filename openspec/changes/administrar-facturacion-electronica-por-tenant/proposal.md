## Why

Manus already emits billing work through the integration outbox and the dedicated billing backend resolves tenant provider configuration, but there is no verified administrative contract for managing that configuration per tenant. This gap makes tenant-to-FactuCore identity errors hard to prevent and hard to audit, including the reported KSOLECTRI incident.

The change establishes a safe, SUPER_ADMIN-only management flow. It must preserve the current provider boundary, avoid direct FactuCore database access, and block billing when the authenticated Manus tenant, fiscal issuer, and configured FactuCore tenant cannot be proven consistent.

## What Changes

- Add an administrative contract to list, inspect, create, update, disable, and test a tenant's electronic-billing configuration.
- Reuse `electronic_billing_providers` and `tenant_electronic_billing_configs`; verify schema drift before proposing any migration.
- Use the existing V089 `encrypted_credentials` column for new administrative writes only after the billing-backend AES-256-GCM v1 implementation and external key ownership are verified; retain `credential_reference` as a compatibility fallback and never persist or return raw credentials.
- Add write-once credential input semantics and masked configuration status for the frontend wizard.
- Add a FactuCore connection/identity verification operation through the billing backend, using only a proven authenticated read-only HTTP contract. The current repository has no such identity endpoint; the proposed contract remains unimplemented.
- Add fiscal identity read-only lookup and compare it with the expected Manus tenant issuer before enabling billing.
- Add audit events for configuration changes, credential replacement, identity checks, and blocked mismatches.
- Add multi-tenant tests covering the principal tenant and KSOLECTRI without using real secrets or issuing documents. Shared KSOLECTRI credentials are an owner-accepted QA fixture only; production requires issuer and FactuCore identity validation.
- Do not change POS issuance, historical documents, `main`, or `develop` in this planning phase.

## Capabilities

### New Capabilities

- `tenant-electronic-billing-admin`: SUPER_ADMIN-only tenant configuration and safe status/read models.
- `factucore-tenant-identity-validation`: provider-side identity verification and mismatch blocking.
- `electronic-billing-secret-handling`: write-once credentials, secret redaction, and approved reference resolution.
- `electronic-billing-admin-audit`: auditable administrative actions without secret material.

### Modified Capabilities

- `provider-configuration`: extend existing tenant provider configuration with administrative lifecycle and safe response rules.
- `multitenant-isolation`: extend existing isolation requirements to administrative reads, writes, identity checks, and audit records.

## Impact

- `api/`: new administrative boundary, SUPER_ADMIN authorization, tenant/fiscal issuer validation, audit integration, and internal client contract.
- `backend-facturacion-electronica/`: provider identity/status capability only after its real FactuCore contract is verified; no direct database access from Manus.
- `web/app/[tenant]/configuracion/page.tsx` and `web/domains/tenants/`: electronic-billing section in the existing tenant wizard.
- `scripts/database/migrations/`: only if schema drift analysis proves a required additive migration.
- `openspec/`: this change extends existing billing extraction and multiprovider contracts; it does not duplicate their runtime ownership rules.
