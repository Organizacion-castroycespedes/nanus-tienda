# HU-EB-ADM-001 Evidence

## Git

- Branch: `feat/develop/administracion-facturacion-electronica-tenants`.
- Base HEAD observed: `7a4381c7967c7bfc70aae02cfba21bb32050ecb5`.
- Worktree already contained Phase 1, 2A, 2B, 3A, FactuCore context integration, and untracked V089 work. These changes were preserved.
- No commit, stage, push, merge, rebase, reset, clean, checkout, or unrelated source change was performed for HU-EB-ADM-001.

## Schema evidence

- `V072__electronic_billing_base_persistence.sql` defines `electronic_billing_providers` with `id`, `code`, `name`, `provider_type`, `active`, `capabilities`, timestamps, and unique `code`.
- `tenant_electronic_billing_configs.provider_id` references the provider with `ON DELETE RESTRICT`.
- `electronic_documents.provider_id` and its composite provider/config reference use `ON DELETE RESTRICT`.
- `V088__electronic_billing_default_config_integrity.sql` clears disabled defaults and creates the partial unique index for one enabled default per tenant.
- The existing QA snapshot contains the provider unique constraint and the provider foreign keys. No migration is required for the contract phase.

## QA dependency query

`psql` was present and required DB variables were present in `api/.env`, but the configured `DB_HOST` was not proven local (`DB_HOST_LOCAL=False`). No connection was attempted. Counts are therefore `UNKNOWN`:

| Provider aggregate | Result |
| --- | --- |
| Provider count / active states | UNKNOWN |
| Enabled tenant configuration dependencies | UNKNOWN |
| Historical document dependencies | UNKNOWN |

The planned query is SELECT-only and returns only provider code, active state, and aggregate dependency counts. It must run only after an explicitly authorized QA endpoint is identified as non-production. No tenant identity, fiscal data, credential reference, encrypted credential, or document content is selected.

## Contract decisions

- Provider catalog remains owned by Billing Backend; MANUS API is the SUPER_ADMIN proxy.
- Registration requires a normalized unique code and a registered adapter. It never activates tenant billing.
- Provider identity is immutable after creation. Deletion is unsupported.
- Deactivation fails closed when enabled tenant configurations reference the provider and requires a transactionally locked dependency check.
- DTOs exclude credentials, ciphertext, key identifiers, URLs, headers, and raw exceptions.

## HU-EB-ADM-002 implementation evidence

- Internal routes implemented in `backend-facturacion-electronica/src/modules/electronic-billing/admin/electronic-billing-admin.controller.ts`:
  - `POST /internal/electronic-billing/admin/providers`
  - `PATCH /internal/electronic-billing/admin/providers/:providerId`
  - `PATCH /internal/electronic-billing/admin/providers/:providerId/status`
- Existing `GET /internal/electronic-billing/admin/providers` remains unchanged.
- Every new route validates the existing `API_INTERNAL_TOKEN` before reading the body or calling the service.
- `ElectronicBillingProviderRepository.findByIdForUpdate()` uses PostgreSQL `FOR UPDATE` inside `DatabaseService.transaction()`.
- Deactivation checks enabled tenant configuration counts in the same transaction and returns a conflict. Historical document references are not changed.
- Provider creation normalizes code, checks `ElectronicBillingProviderRegistry`, validates the fixed capability map, and maps PostgreSQL unique violation `23505` to a safe conflict.
- Metadata updates cannot change `id`, `code`, or `providerType`. No delete handler exists.
- Targeted provider-admin, repository, controller, and runtime tests passed. Full Billing Backend suite: 264 total, 249 passed, 15 supported integration tests skipped; 0 failed.
- Billing Backend build passed. No QA or production database was changed.

## HU-EB-ADM-003 implementation evidence

- MANUS routes implemented:
  - `GET /api/admin/electronic-billing/providers` (backward-compatible read)
  - `POST /api/admin/electronic-billing/providers`
  - `PATCH /api/admin/electronic-billing/providers/:providerId`
  - `PATCH /api/admin/electronic-billing/providers/:providerId/status`
- Every route uses `JwtAuthGuard`, `RolesGuard` with `SUPER_ADMIN`, and `PermissionsGuard`. Read uses `READ`; mutations use `WRITE` for `MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS`.
- The permission key is fail-closed for non-`SUPER_ADMIN` callers and has no menu/database seed yet. HU-EB-ADM-004 must register the menu item and role-permission mapping before non-super-admin use is considered.
- The proxy forwards only validated catalog fields through the server-side `API_INTERNAL_TOKEN`. Browser authorization is never forwarded to Billing Backend. No tenant configuration, credential, document, or FactuCore operation is reachable from these routes.
- Upstream `400`, `404`, and `409` map to sanitized MANUS exceptions; transport, timeout, and unexpected upstream failures map to sanitized `503`. Upstream bodies are not returned.
- Focused MANUS tests: 19 passed, 0 failed, including real Nest module bootstrap, role denial for `ADMIN`, `SUPER_USER`, and `USER`, missing bearer token, missing provider permission, DTO validation, safe forwarding, conflict/not-found/unavailable mapping, and GET compatibility. API build passed.

## HU-EB-ADM-004 implementation evidence

- Added idempotent `scripts/database/migrations/V105__electronic_billing_providers_menu_permissions.sql`.
- The migration creates/updates child menu key `ELECTRONIC_BILLING_PROVIDERS` under `CONFIG_GENERAL`, route `/{tenant}/configuracion/facturacion-electronica/proveedores`, and grants `WRITE` only to `SUPER_ADMIN`. It does not run against QA or production in this task.
- Added browser route `/[tenant]/configuracion/facturacion-electronica/proveedores` and a responsive provider catalog UI. Browser calls use only the MANUS API GET/POST/PATCH routes.
- The UI supports search, safe metadata display, FACTUCORE-only creation, metadata edit, controlled status confirmation, and sanitized `400/403/404/409/503` feedback. It has no delete action and no credential or FactuCore access.
- Direct route access checks `SUPER_ADMIN`, menu permission readiness, and `ELECTRONIC_BILLING_PROVIDERS` read access. Backend guards remain authoritative.
- Frontend model tests cover route permission mapping, code normalization, capability filtering, and sensitive-field rejection. Browser workflow QA remains a separate manual check; the migration was applied only to authorized QA.
- Authorized QA SELECT-only evidence after V105: `FACTUCORE`, active `true`, enabled tenant configurations `2`, historical electronic documents `207`. No tenant IDs, fiscal data, credentials, references, ciphertext, or document content were selected. No provider lifecycle mutation was performed.
- V105 application evidence: exact repository checksum `951102099120731a3985cd4ff123a2008385e4179a03d562b497d255004772c1`; QA history row is `success=true`; three provider-menu rows and three `SUPER_ADMIN|WRITE` permission rows exist. No `ADMIN`, `SUPER_USER`, or `USER` grant exists.
