## Context

MANUS already has a provider catalog in `public.electronic_billing_providers`, tenant assignments in `public.tenant_electronic_billing_configs`, and historical provider references in `public.electronic_documents`. The current Billing Backend owns `ElectronicBillingProviderRepository` and `ElectronicBillingProviderRegistry`; MANUS API exposes the existing read-only catalog through a SUPER_ADMIN proxy authenticated internally with `API_INTERNAL_TOKEN`.

The schema evidence is sufficient for contracts. `electronic_billing_providers.code` has a unique constraint. Tenant configuration and document foreign keys use `ON DELETE RESTRICT`. V088 also enforces at most one enabled default configuration per tenant. No new table or migration is needed for this contract phase.

HU-EB-ADM-001 defined the boundary. HU-EB-ADM-002 implements the Billing Backend internal catalog handlers. HU-EB-ADM-003 adds the MANUS SUPER_ADMIN proxy. HU-EB-ADM-004 adds the idempotent `V105__electronic_billing_providers_menu_permissions.sql` artifact and the browser UI. Credentials, tenant activation, and FactuCore calls remain out of scope.

## Goals / Non-Goals

**Goals:**

- Define stable MANUS and Billing Backend routes for provider catalog administration.
- Define safe request and response DTOs with immutable identity and no credential fields.
- Require adapter registry validation, code normalization, capability validation, and consistent errors.
- Protect deactivation with a transactionally consistent enabled-configuration check.
- Preserve tenant configuration, credentials, FactuCore settings, and historical documents.
- Keep SUPER_ADMIN and internal service authentication explicit and testable.
- Capture sanitized QA dependency counts when an authorized local QA connection exists.

**Non-Goals:**

- No credential UI, FactuCore call, fiscal issuance, or live database mutation. The menu artifact changes only `menu_items` and `role_menu_permissions` through the normal deployment process; the MANUS write proxy remains limited to the guarded routes described below.
- No dynamic adapter loading, arbitrary URL registration, credential management, tenant activation, or invoice issuance.

## Decisions

### 1. Bounded-context ownership

The Billing Backend owns provider persistence and adapter registry validation. MANUS API remains the SUPER_ADMIN authorization proxy. This reuses the existing repository, registry, `API_INTERNAL_TOKEN`, and route conventions instead of creating a second provider source of truth.

Alternative rejected: direct provider CRUD in MANUS API. It would duplicate billing ownership and weaken the bounded-context boundary.

### 2. Route contract

MANUS routes:

- `GET /api/admin/electronic-billing/providers` remains backward-compatible.
- `POST /api/admin/electronic-billing/providers` creates catalog metadata.
- `PATCH /api/admin/electronic-billing/providers/:providerId` updates mutable metadata.
- `PATCH /api/admin/electronic-billing/providers/:providerId/status` changes catalog status.

Billing internal routes mirror these paths below `internal/electronic-billing/admin/providers` and require the established internal bearer token. No DELETE route exists.

All MANUS mutation routes SHALL use `JwtAuthGuard`, `RolesGuard` with `SUPER_ADMIN`, and the existing `PermissionsGuard`/menu permission convention when the menu capability is introduced. Backend authorization remains mandatory even if the menu hides the module.

### 3. DTO and validation boundary

Request DTOs contain only catalog metadata:

- Create: `code`, `name`, fixed `providerType: "ELECTRONIC_BILLING"`, and the complete known capability map.
- Metadata update: `name` and capability map only; `code`, `id`, and `providerType` are immutable.
- Status update: `active` only.

The safe response contains `id`, normalized `code`, `name`, `providerType`, `active`, capabilities, timestamps, and sanitized dependency counts. It never contains `credential_reference`, `encrypted_credentials`, URLs, keys, headers, tokens, ciphertext, or internal exceptions.

Codes SHALL be trimmed, uppercased, validated against the provider-code format, and checked against the database unique constraint. Names SHALL be trimmed and bounded. Capabilities SHALL be limited to the existing registry capability keys and SHALL not claim an adapter capability that the registered adapter does not provide. Registration SHALL fail if the normalized provider code has no registered adapter.

### 4. Safe lifecycle rules

Creating a catalog entry never creates or enables a tenant configuration. Status deactivation SHALL fail with a conflict while any enabled tenant configuration references the provider. The check and status update SHALL occur in one transaction that locks the provider row and rechecks dependencies. A unique-code race SHALL be returned as a sanitized conflict. Provider deletion is unsupported because both tenant configurations and historical documents use `ON DELETE RESTRICT` references.

### 5. Read-only evidence

QA evidence may report only provider code, active state, enabled-configuration count, and historical-document count. Tenant IDs, fiscal data, credential references, encrypted values, and document contents are forbidden. If a local QA connection cannot be proven safe and authorized, counts remain `UNKNOWN`; no fallback connection is attempted.

### 6. Incremental delivery

HU-EB-ADM-001 supplied the contract and evidence artifacts. HU-EB-ADM-002 implements the Billing Backend internal CRUD and transactional checks. HU-EB-ADM-003 implements the MANUS proxy with `JwtAuthGuard`, `RolesGuard` (`SUPER_ADMIN`), `PermissionsGuard`, and `MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS`. HU-EB-ADM-004 registers that key only for `SUPER_ADMIN`, adds route-permission protection, and provides metadata-only UI actions. Credential or FactuCore identity work stays behind the existing tenant-administration gates.

## Risks / Trade-offs

- [Risk] Runtime adapter registry and catalog codes can diverge. → Reject registration unless the normalized code is registered and capabilities are a subset of the adapter.
- [Risk] A deactivation race can leave an enabled tenant configuration using an inactive provider. → Lock and recheck dependencies in one transaction; return conflict on any enabled reference.
- [Risk] Historical documents make deletion unsafe. → Do not expose a delete contract; retain rows and use controlled deactivation only.
- [Risk] Existing callers depend on the current GET response. → Preserve the current GET shape and add only safe, non-secret metadata in a compatible way.
- [Risk] Global permission and menu identifiers are not yet seeded. → Keep public access disabled; introduce one reviewed permission/menu change with the later API/UI story.

## Migration Plan

No migration is planned. Before implementation, verify the existing V072/V088 schema and QA snapshot. Implementations must use the current tables and constraints. Rollback is source rollback only; no database rollback is needed for this HU.

## Open Questions

- Which existing menu key and permission identifier should own the future provider module without changing tenant-scoped billing permissions?
- Should dependency counts be returned by every provider response or only by a dedicated safe detail operation?
- Future tenant-configuration writers must use the same provider-row lock before enabling a configuration; this remains a prerequisite for HU-EB-ADM-003 or later write work.
