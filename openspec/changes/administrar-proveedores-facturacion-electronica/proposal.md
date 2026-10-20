## Why

Manus already stores a provider catalog and tenant assignments, but global provider administration has no formal safe contract. This change defines the SUPER_ADMIN catalog boundary before any CRUD implementation, so provider metadata cannot alter tenant credentials, activation, historical documents, or FactuCore behavior by accident.

## What Changes

- Define backward-compatible read and administrative provider-catalog contracts for the MANUS API proxy and the dedicated Billing Backend.
- Define strict request and safe response DTOs for provider creation, metadata update, status change, dependency summary, and validation errors.
- Require normalized unique provider codes and runtime adapter availability before registration.
- Keep provider identity immutable after creation; disallow provider deletion.
- Require transactional dependency checks before deactivation and preserve tenant configurations, credentials, FactuCore settings, and historical documents.
- Document SUPER_ADMIN, `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, and internal `API_INTERNAL_TOKEN` enforcement.
- Record read-only QA dependency evidence without exposing tenant, fiscal, credential, or secret data.
- HU-EB-ADM-002 implements the Billing Backend internal CRUD described by the contracts. HU-EB-ADM-003 adds the SUPER_ADMIN MANUS API proxy. HU-EB-ADM-004 adds the guarded configuration menu entry and provider catalog UI. Credential writes, FactuCore calls, and fiscal issuance remain out of scope.

## Capabilities

### New Capabilities

- `global-provider-catalog-administration`: Safe contracts and invariants for global electronic billing provider catalog administration.

### Modified Capabilities

- None. Existing tenant billing administration and multi-provider issuance requirements remain unchanged.

## Impact

- OpenSpec contracts consumed later by `api/` and `backend-facturacion-electronica/`.
- Existing `electronic_billing_providers`, `tenant_electronic_billing_configs`, and `electronic_documents` schema dependencies.
- Existing `ElectronicBillingProviderRepository`, `ElectronicBillingProviderRegistry`, internal billing routes, MANUS admin proxy, and permission/menu governance.
- Depends on `administrar-facturacion-electronica-por-tenant` and `integrar-facturacion-electronica-multiproveedor`.
- No credential, FactuCore, fiscal issuance, or live database operation is included. HU-EB-ADM-004 supplies only a versioned idempotent menu/permission migration for normal deployment.
