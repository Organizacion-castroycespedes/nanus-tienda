# Design

## Policy

The Billing Backend evaluates credential mode from server-owned runtime configuration. Frontend values, tenant settings, and administrative DTOs cannot select the mode.

Defaults:

1. Non-empty `encrypted_credentials` is authoritative.
2. A `v2.` envelope always uses AES-256-GCM v2 and never uses legacy resolution.
3. Empty ciphertext preserves the existing `credential_reference` resolver.
4. A non-empty `v1.` envelope is legacy-eligible only when the deployment gate is explicitly true and the exact tenant/provider/configuration/environment tuple is present in the server allowlist.
5. Unknown, malformed, or corrupt ciphertext always fails closed.

Runtime inputs:

- `ELECTRONIC_BILLING_LEGACY_REFERENCE_ENABLED`, default `false`.
- `ELECTRONIC_BILLING_LEGACY_REFERENCE_ALLOWLIST`, JSON array of server-owned entries with `tenantId`, `providerId`, `providerConfigId`, `providerCode`, and `environment`.

Malformed gate or allowlist is deny-all. Empty allowlist is deny-all. No production entry is supplied by this change.

## Security boundary

`ElectronicBillingCredentialTransitionPolicy` only classifies the envelope and returns an allow/deny decision. It never reads or returns a legacy secret. Existing environment resolution runs only after an explicit allow decision.

The policy rejects:

- v2 override attempts;
- unknown or malformed versions;
- tenant, provider, configuration, or environment mismatches;
- missing credential references;
- disabled gate or missing allowlist entry.

Diagnostics contain only operation, correlation-safe identifiers already present in the context, envelope category, and decision category. No values, ciphertext, key IDs, headers, or secret payloads are logged.

## Compatibility

The policy is inside `TenantElectronicBillingCredentialResolver`, which is already shared by invoice issuance and `get_client_context`. `FactuCoreClient`, FactuCore scopes, outbox behavior, retries, idempotency, and tenant identity contracts remain unchanged.

No database migration is needed. Existing `settings.factuCoreTenantId` remains an expected mapping only; authenticated FactuCore identity remains authoritative.

## Rollout and rollback

This implementation rolls out with the gate false and no entries. Rollback is deployment rollback to the previous Billing Backend binary. Enabling legacy later requires a separate operational approval, verified credential ownership, tenant identity validation, and a separate change/evidence record.
