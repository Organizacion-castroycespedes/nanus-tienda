# Phase 1 evidence

Date: 2026-10-15

## Scope and Git

- Branch: `feat/develop/administracion-facturacion-electronica-tenants`.
- Base and current `HEAD`: `cc3bedd8574ac0baaedee1e84e4c0a3c841a594a`.
- `develop` and `origin/develop` point to the same base commit.
- No unrelated tracked or untracked changes were present before this phase. The only worktree changes are this OpenSpec change and the focused FactuCore logging correction.
- No commit, push, merge, rebase, reset, clean, staging, or document issuance was performed.

## Schema evidence

Read-only inspection used the local configured QA connection and returned `manus_tienda_qa` as database and `manus_user` as database user. No writes were issued.

Confirmed in the target schema:

- `public.electronic_billing_providers` exists.
- `public.tenant_electronic_billing_configs` exists.
- `credential_reference TEXT` exists.
- `settings JSONB NOT NULL DEFAULT '{}'` exists.
- `encrypted_credentials TEXT` exists in the target schema.
- The partial unique index `ux_tenant_electronic_billing_configs_enabled_default` exists.
- Tenant/provider/environment foreign keys and the existing uniqueness constraints exist.

Drift:

- Current `V072__electronic_billing_base_persistence.sql` does not declare `encrypted_credentials`.
- The checked-in `database/manus_tienda_qa.sql` snapshot does not declare `encrypted_credentials`.
- Migration history records `V089__tenant_electronic_billing_encrypted_credentials.sql` as applied successfully. Its historical Git source is commit `2dc2ed8159e40f7889911b97337465c6f11337a1` and adds `encrypted_credentials TEXT` plus a no-plaintext comment.
- The historical file SHA-256 is `5161f4bccdb8c3a239124a303410b4b6ffc9427718c7fd292679d137372fd620`; it exactly matches the QA `migration_history.checksum`. Provenance is therefore resolved.
- The V089 artifact is absent at current branch `HEAD`, and the checked-in QA snapshot is stale. This is repository/schema drift. It is not a reason to create a second V089 migration.
- Historical Git inspection proves an AES-256-GCM v1 crypto implementation existed in a later commit, using a 32-byte external `ELECTRONIC_BILLING_ENCRYPTION_KEY`, with authenticated decrypt and no plaintext persistence. That implementation is not present in the current branch runtime. Current source does not prove billing-backend key injection, rotation, recovery ownership, or credential-write behavior.

Decision: no database migration and no credential persistence implementation in Phase 1.1. Selected Phase 2 storage is V089 `encrypted_credentials` with AES-256-GCM v1, owned by the dedicated billing backend; `credential_reference` remains the environment-resolution fallback. Manus API must authorize as `SUPER_ADMIN` but never decrypt. Missing or invalid external key fails closed. Phase 2 must reconcile the repository artifact/snapshot and prove runtime key ownership before writes.

## FactuCore contract

The repository includes `backend-facturacion-electronica/FactuCore/FactuCore_API_Guia_Integracion_Definitiva.docx`. It confirms:

- Authentication uses `x-client-key` and `x-client-secret` on every request.
- The API Client automatically determines the FactuCore tenant/company.
- API Clients must be active, unexpired, and satisfy configured IP restrictions.
- Scopes include `documents:create` and `documents:read`, plus XML/sign/transmit scopes.
- External routes are document routes under `/api/v1/external/documents/*`.
- Document create/status routes exist; create, XML generation, signing, and transmission have document side effects.
- No read-only external endpoint for API-client identity, FactuCore tenant identity, issuer fiscal identity, or DIAN readiness was found in the guide or local FactuCore source.

Confirmed implementation mapping:

- `settings.factuCoreTenantId` is required by `FactuCoreProvider` and passed into runtime context.
- `FactuCoreClient` sends the credentials as headers but does not itself validate tenant ownership.
- `FiscalLookupController` exposes only `POST /fiscal-lookup/preview` and `POST /fiscal-lookup/sync`; it is not an authenticated FactuCore tenant-identity endpoint.

Decision: identity validation remains `BLOCKED_WITHOUT_PROVEN_FACTUCORE_ENDPOINT`. Do not invent or call a document endpoint as an identity check. OpenSpec defines a future read-only authenticated FactuCore endpoint only after FactuCore owner approval. Independent repository/API/DTO/audit/crypto-test work can proceed without it; readiness and production activation cannot.

Proposed contract recorded in `design.md` only: `GET /api/v1/external/client-context`, existing client headers plus a new least-privilege `tenant:read` scope, and a response containing API-client identity, tenant identity, issuer fiscal identity, and sanitized DIAN readiness. This route is not implemented or treated as available.

## KSOLECTRI diagnosis

The authorized read-only QA query emitted only MD5 fingerprints and safe state fields. No secret, NIT, legal name, client key, client secret, or raw JSON was emitted.

Observed mapping:

- KSOLECTRI tenant fingerprint: `ae957c701fb21827d83513879f3e66ef`.
- KSOLECTRI issuer/NIT fingerprint: `c6c32f63a51c5182324ab867ce43fdbe`.
- KSOLECTRI credential-reference fingerprint: `99401c1c6173e27ce7a2b150c6247d5e`.
- KSOLECTRI encrypted-credentials fingerprint: `89a48301fabe9e00c2fe2baaa511630d`.
- KSOLECTRI `factuCoreTenantId` fingerprint: `f3e4128e3422c95a5fd9795270a736d6`.
- KSOLECTRI config state: `HABILITATION`, enabled, default.
- Another tenant fingerprint `c96589eefb0828c07179095bcd0cef5f` has the same credential-reference fingerprint and the same encrypted-credentials fingerprint. Its enabled default `HABILITATION` row has a different `factuCoreTenantId` fingerprint `8385f33b437320a04e10ccd84c4a5791`; its disabled `TEST` row also uses that same FactuCore tenant fingerprint.
- The other tenant issuer/NIT fingerprint is `6b694cc24d95c438cbfd976246a73005`.

This proves credential-reference and encrypted-blob reuse across tenants in QA. The owner has confirmed this is an authorized, controlled QA fixture. It is not an incident blocker and no QA credential is changed. It does not prove which FactuCore API Client owns the secret, because FactuCore exposes no verified identity endpoint and the API client registry is not available through Manus. The production rule remains strict: shared credentials cannot establish tenant ownership; authenticated FactuCore identity and issuer matching are required.

## Logging security correction

Before this phase, `FactuCoreClient` logged request bodies, full response payloads, binary error bodies, and full URLs. Request bodies and responses can contain fiscal personal data; full URLs can carry userinfo if a misconfigured base URL contains it.

Changed:

- Request logs now contain only path, method, operation, and `bodyPresent`.
- Response logs now contain only status, operation, body presence, and body length.
- Binary error logs no longer include response body content.
- Validation text redaction now handles quoted JSON-style secret fields as well as `key=value` forms.
- Focused regression coverage asserts that legal name, identification number, provider secret, and `x-client-secret` do not appear in client logs.

Operational status, operation name, HTTP status, path, and response size remain available.

## Verification

- `PHASE_1_1=PARTIAL`: V089 provenance/checksum and QA fixture boundary are resolved; current-branch key ownership/runtime wiring and FactuCore identity endpoint remain Phase 2 prerequisites.
- `npx.cmd tsx --test test/factucore.client.spec.ts`: 15 passed, 0 failed.
- `npm.cmd run build` in `backend-facturacion-electronica`: passed.
- `openspec validate administrar-facturacion-electronica-por-tenant --strict --type change --no-interactive`: valid.
- No UI or administrative API was implemented.

## Phase 2 prerequisites

1. Reconcile the missing V089 repository artifact and stale schema snapshot through an approved repository-only change; do not create a duplicate migration or alter QA.
2. Prove billing-backend ownership of the external 32-byte encryption key, AES-256-GCM v1 implementation, rotation/versioning, recovery, and fail-closed writes.
3. Define and obtain FactuCore approval for the authenticated read-only client-context contract, including API-client binding, tenant identity, issuer identity, and DIAN readiness.
4. Implement Manus SUPER_ADMIN authorization and tenant-scoped safe DTOs, then the internal billing-backend administration contract.
5. Add non-document-side-effect contract tests for principal tenant and KSOLECTRI QA fixture, including mismatch blocking and secret-safe logs.
