# Phase 1 evidence

Date: 2026-10-15

## Scope and Git

- Branch: `feat/develop/administracion-facturacion-electronica-tenants`.
- Checkpoint and current `HEAD`: `7a4381c7967c7b70aae02cfba21bb32050ecb5`.
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
- The checked-in `database/manus_tienda_qa.sql` snapshot now declares `encrypted_credentials TEXT`, matching the verified QA table.
- Migration history records `V089__tenant_electronic_billing_encrypted_credentials.sql` as applied successfully. Its historical Git source is commit `2dc2ed8159e40f7889911b97337465c6f11337a1` and adds `encrypted_credentials TEXT` plus a no-plaintext comment.
- The historical file SHA-256 is `5161f4bccdb8c3a239124a303410b4b6ffc9427718c7fd292679d137372fd620`; it exactly matches the QA `migration_history.checksum`. Provenance is therefore resolved.
- The recovered V089 artifact is present as an untracked file in this worktree. Its SHA-256 is exact. The snapshot was reconciled with the verified live column. V089 was not executed and no duplicate migration was created.
- Historical Git inspection proves an older AES-256-GCM v1 implementation existed in a later commit. Phase 2A implements a distinct `v2.<keyId>.<nonce>.<tag>.<ciphertext>` envelope with AAD binding tenant/config/provider. Existing QA ciphertext is not decrypted or overwritten.

Decision: no database execution and no administrative write path. Phase 2A provides the safe resolver foundation for V089 `encrypted_credentials`, using AES-256-GCM v2 in the dedicated billing backend; `credential_reference` remains the environment-resolution fallback only when ciphertext is absent. Manus API must authorize as `SUPER_ADMIN` but never decrypt. Missing, invalid, unsupported, or wrongly bound ciphertext fails closed. Operational secret-manager ownership and recovery approval remain prerequisites for writes.

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
- `PHASE_2A=PARTIAL`: schema snapshot and V089 artifact reconciled; encrypted resolver foundation implemented and tested; no administrative writes or FactuCore identity activation enabled.
- V089 SHA-256: `5161f4bccdb8c3a239124a303410b4b6ffc9427718c7fd292679d137372fd620`.
- Snapshot parity: `database/manus_tienda_qa.sql` includes `encrypted_credentials TEXT`; no unrelated schema change was made.
- Focused backend run: 246 tests discovered, 231 passed, 15 skipped, 0 failed.
- New crypto/resolver coverage: 7 passed, including nonce uniqueness, AAD binding, rotation, missing key, unsupported version, encrypted precedence, corruption fail-closed, and legacy env fallback.
- `npx.cmd tsx --test test/factucore.client.spec.ts`: 15 passed, 0 failed.
- `npm.cmd run build` in `backend-facturacion-electronica`: passed.
- `openspec validate administrar-facturacion-electronica-por-tenant --strict --type change --no-interactive`: valid.
- `git diff --check`: passed; only line-ending warnings for existing TypeScript files.
- No UI, SUPER_ADMIN administrative API, credential write endpoint, or FactuCore identity endpoint was implemented.

## Phase 2 prerequisites

1. Add the recovered V089 artifact through the normal review path; it is currently untracked and must not be executed again.
2. Prove billing-backend ownership of secret-manager provisioning, rotation approval, escrow/recovery, and fail-closed credential writes for the v2 key ring.
3. Define and obtain FactuCore approval for the authenticated read-only client-context contract, including API-client binding, tenant identity, issuer identity, and DIAN readiness.
4. Implement Manus SUPER_ADMIN authorization and tenant-scoped safe DTOs, then the internal billing-backend administration contract.
5. Add non-document-side-effect contract tests for principal tenant and KSOLECTRI QA fixture, including mismatch blocking and secret-safe logs.

## Phase 2B evidence

`PHASE_2B=PARTIAL`.

Implemented read-only routes:

- Manus API: `GET /api/admin/electronic-billing/providers`.
- Manus API: `GET /api/admin/electronic-billing/tenants/:tenantId/config`.
- Billing backend: `GET /internal/electronic-billing/admin/providers`.
- Billing backend: `GET /internal/electronic-billing/admin/tenants/:tenantId/config`.

Authorization evidence:

- Manus routes use existing `JwtAuthGuard` and `RolesGuard`, with `@Roles("SUPER_ADMIN")`.
- Manus validates target tenant existence by UUID before the billing call.
- Billing routes use the existing `Authorization: Bearer API_INTERNAL_TOKEN` mechanism.
- Billing config SQL scopes by `config.tenant_id = $1`.
- Missing or malformed internal authorization is rejected.
- Missing tenant prevents the billing call.
- No frontend route, public billing-backend route, write route, activation route, or FactuCore identity route was added.

Safe DTO evidence:

- Provider reads return provider id/code/name, active state, and capabilities.
- Tenant reads return provider/environment/enabled/default state, base URL presence, credential presence booleans, and `settings.factuCoreTenantId`.
- Tenant rows return sanitized `configurationStatus`: `COMPLETE`, `INCOMPLETE`, or `INCONSISTENT`; this is configuration completeness only, not FactuCore readiness.
- Responses never return `encrypted_credentials`, `credential_reference`, key IDs, decrypted values, raw provider payloads, SQL, or internal exception details.
- Billing SQL uses boolean presence projections. It does not select or decrypt ciphertext for administrative reads.

Internal contract evidence:

- `BillingIntegrationClient` uses the existing internal base URL and bearer token.
- Non-2xx administrative reads become sanitized service errors.
- Existing POS outbox routes and document mutation routes remain unchanged.

Validation:

- Billing backend full suite: 249 tests, 234 passed, 15 skipped, 0 failed.
- Billing backend focused administrative/security tests: 10 passed, 0 failed.
- Manus API focused administrative tests: 3 passed, 0 failed.
- Billing backend build: passed.
- Manus API build: passed.
- OpenSpec strict: valid.
- `git diff --check`: passed; only normal CRLF conversion warnings appeared.

Unresolved gates:

- Operational ownership of the external encryption key, rotation approval, escrow, and recovery is still unresolved.
- FactuCore `GET /api/v1/external/client-context` remains proposed and unavailable.
- Credential writes, credential rotation, activation, readiness, and production use remain disabled.

## Phase 3A evidence

`PHASE_3A=PARTIAL`: the read-only SUPER_ADMIN wizard slice is implemented. The phase remains partial because credential administration and authenticated FactuCore identity validation are not implemented.

Implemented frontend files:

- `web/domains/electronic-billing/api.ts` uses the existing authenticated `apiClient` for the two verified Manus GET routes.
- `web/domains/electronic-billing/types.ts` defines the safe catalog/configuration response types.
- `web/domains/electronic-billing/read-model.ts` copies only approved safe fields and has focused unsafe-field detection coverage.
- `web/domains/electronic-billing/TenantElectronicBillingReadOnly.tsx` renders the wizard read step with tenant-scoped abort/stale-response protection and loading, empty, denied, error, and inconsistent states.
- `web/app/[tenant]/configuracion/page.tsx` adds the step before `Revisión` and preserves existing wizard save behavior.

Security evidence:

- Visibility is restricted by the existing `authUser.role === "SUPER_ADMIN"` check; the existing `SUPER_USER` path does not render the section.
- Browser requests are GET-only to Manus API. No direct Billing Backend or FactuCore request exists in the frontend change.
- The UI renders credential presence booleans only. It does not render `clientSecret`, `credential_reference`, ciphertext, key IDs, authorization headers, raw provider payloads, or exception details.
- `configurationStatus=COMPLETE` is displayed as configuration completeness only. It is not labeled as identity verification or DIAN readiness.
- Changing tenant aborts the previous request and clears the prior read model before loading the new tenant.

Validation:

- `web/domains/electronic-billing/read-model.spec.ts`: 2 passed, 0 failed.
- `npm.cmd run lint` in `web`: passed with no reported findings.
- `npm.cmd run build` in `web`: passed; route `/[tenant]/configuracion` compiled.
- `npx.cmd tsc --noEmit` in `web`: pre-existing failures remain in unrelated `*.spec.ts` files; no Phase 3A file was reported.
- OpenSpec strict validation and `git diff --check` remain required after this evidence update.

Phase 3A limitations:

- No credential write-once UI, rotation, activation, connection test, invoice issuance, fiscal identity result, or FactuCore client-context handling was added.
- Browser-level component tests are not wired in this repository; focused pure read-model tests plus production build/lint provide the available frontend validation. Browser QA remains a Phase 6 gate.

## Administrative API runtime DI regression evidence

`ROOT_CAUSE=CONFIRMED`.

Manual runtime QA showed both administrative handlers failing because the controller's private `service` property was `undefined`. Source inspection confirmed the service was listed in `ElectronicInvoicingModule.providers`, but `ElectronicBillingAdminService` lacked `@Injectable()`. The API development command uses `tsx watch`; without explicit injection metadata, Nest did not receive the constructor dependency and did not fail startup. The controller also relied on implicit constructor metadata.

Minimal correction:

- `api/src/modules/electronic-invoicing/admin/electronic-billing-admin.service.ts`: add `@Injectable()` and explicit tokens for `DatabaseService` and `BillingIntegrationClient`.
- `api/src/modules/electronic-invoicing/admin/electronic-billing-admin.controller.ts`: inject `ElectronicBillingAdminService` explicitly.
- `api/src/modules/electronic-invoicing/admin/electronic-billing-admin.runtime.spec.ts`: initialize a real Nest application context with the real controller/service and test-only external boundary providers; exercise provider catalog and tenant configuration handlers; verify `SUPER_ADMIN` metadata and allow/deny behavior.

No route path, guard, tenant validation, billing client contract, database schema, FactuCore call, credential, or fiscal document behavior changed.

Runtime validation:

- `electronic-billing-admin.runtime.spec.ts` plus existing admin controller/service specs: 4 passed, 0 failed.
- Real `NestFactory.createApplicationContext` initialized the controller and service with test-only database and billing-client boundary providers.
- Provider catalog handler returned the safe provider catalog.
- Tenant configuration handler returned the requested tenant-scoped configuration.
- `JwtAuthGuard` and `RolesGuard` metadata remained attached; `RolesGuard` allowed `SUPER_ADMIN` and rejected `ADMIN`.
- `npm.cmd run build` in `api`: passed.
- No live development service was restarted or terminated.

## Live HTTP 503 trace

`HTTP_503_ROOT_CAUSE=CONFIRMED` at the MANUS API `BillingIntegrationClient` configuration boundary.

Live process evidence:

- MANUS API: PID `29356`, `node` with `api/node_modules/tsx` loading `src/main.ts`, listener `localhost:4020`, start time `2026-10-15T17:51:18-05:00`.
- Billing Backend: PID `35484`, `node` with `backend-facturacion-electronica/node_modules/tsx` loading `src/main.ts`, listener `localhost:4030`, start time `2026-10-15T17:51:29-05:00`.
- `BILLING_BACKEND_INTERNAL_BASE_URL` resolves to `http://localhost:4030`.
- `API_INTERNAL_TOKEN` is present in Billing Backend `.env`, length checked only. The API `.env` has no populated `API_INTERNAL_TOKEN` entry.
- Both services point to the same QA PostgreSQL host/database/port configuration. Values were not printed.

End-to-end hop evidence:

- Direct Billing Backend `GET /internal/electronic-billing/admin/providers`: HTTP 200, safe `{ providers }` shape.
- Direct Billing Backend `GET /internal/electronic-billing/admin/tenants/00000000-0000-0000-0000-000000000001/config`: HTTP 200, safe configuration shape.
- MANUS API without JWT: HTTP 401 for both routes.
- MANUS API with a newly generated, in-memory QA `ADMIN` token: HTTP 403 for both routes.
- MANUS API with a newly generated, in-memory QA `SUPER_ADMIN` token: HTTP 503 for both routes.
- No JWT, bearer token, cookie, credential, SQL secret, or response body was printed.

The failure occurs before an authenticated internal HTTP request can be made: `getIntegrationOutboxConfig()` reads `API_INTERNAL_TOKEN` from the MANUS API process environment, and `BillingIntegrationClient.getInternalAdminRead()` throws `Billing backend internal client is not configured` when it is empty. `ElectronicBillingAdminService` intentionally converts that controlled internal failure to the sanitized browser HTTP 503. PostgreSQL, Billing Backend routes, internal bearer validation, DI, and QA UUID handling are healthy in the running process.

No source correction is authorized for this configuration-only defect. Safe operator action: provision the exact existing QA `API_INTERNAL_TOKEN` value into the MANUS API process environment or `api/.env` without displaying it, then restart only MANUS API PID `29356` through the normal approved runbook. Do not copy the token into frontend files, logs, browser storage, or source control. No restart or environment modification was performed by this task.

## HTTP 503 runtime diagnosis evidence

`HTTP_503_ROOT_CAUSE=CONFIRMED` with two backend-side causes at different hops:

1. `GET /internal/electronic-billing/admin/providers` reached Billing Backend on `localhost:4030`, but its admin controller/service used implicit constructor injection under the `tsx` runtime. The service dependency was undefined; the controller sanitized the resulting error as HTTP 503. Explicit Nest injection fixed this path.
2. The QA tenant identifier `00000000-0000-0000-0000-000000000001` exists in the read-only QA database. Billing Backend's admin controller rejected it because its UUID regex required RFC version and variant bits. It returned 404, and Manus `ElectronicBillingAdminService` translated the internal failure to HTTP 503. The controller now uses the same generic UUID shape accepted by Manus, preserving malformed-input rejection.

Sanitized environment evidence:

- API listener: `localhost:4020`.
- Billing Backend listener: `localhost:4030`.
- `BILLING_BACKEND_INTERNAL_BASE_URL` is present and resolves to `localhost:4030`.
- `API_INTERNAL_TOKEN` is present in Billing Backend configuration; its value was never printed.
- Read-only QA database connectivity succeeded. Required tables exist: `tenants`, `electronic_billing_providers`, and `tenant_electronic_billing_configs`.
- Provider table metadata is compatible; one provider row exists. No secrets or credential columns were selected.
- Before the fix, direct internal evidence was provider route HTTP 503 and the QA tenant route HTTP 404; no bearer token or response secret was printed.

Correction files:

- `backend-facturacion-electronica/src/modules/electronic-billing/admin/electronic-billing-admin.controller.ts`: explicit service injection and generic UUID validation.
- `backend-facturacion-electronica/src/modules/electronic-billing/admin/electronic-billing-admin.service.ts`: explicit database/repository injection.
- `backend-facturacion-electronica/test/electronic-billing-admin.runtime.spec.ts`: real Nest application-context regression test for both protected reads and internal token rejection.
- `backend-facturacion-electronica/test/electronic-billing-admin.controller.spec.ts`: QA UUID fixture regression test.

Validation:

- Billing admin/runtime tests: 5 passed, 0 failed.
- Billing Backend build: passed.
- Manus API build: passed.
- OpenSpec strict: valid.
- `git diff --check`: passed with existing CRLF warnings only.
- Existing local Billing Backend process was not restarted. Live HTTP success after the code fix requires the operator to restart that already-running development process using its normal approved runbook; no restart was performed here.

## FactuCore client-context integration evidence

Read-only inspection of `D:\Profe\Factucore` at `feat/develop/external-api-client-context` confirmed `GET /api/v1/external/client-context`, `ApiClientAuthGuard`, `ApiClientScopesGuard`, and explicit `tenant:read`. The DTO contains `apiClientId`, effective FactuCore `tenantId`, environment, safe issuer fields, resolution metadata, and configuration-only readiness.

MANUS now uses that contract only through `FactuCoreClient` and the billing backend internal route `GET /internal/electronic-billing/admin/tenants/:tenantId/factucore-context`. The MANUS API route is `GET /api/admin/electronic-billing/tenants/:tenantId/factucore-context`, with `JwtAuthGuard`, `RolesGuard`, `SUPER_ADMIN`, target tenant existence checking, and no mutation path.

The comparison is fail-closed: `MATCH` requires the returned FactuCore tenant to equal the tenant-scoped `settings.factuCoreTenantId` and normalized issuer `nit`, `dv`, and legal name to match `tenants_detalles`; conflicting values produce `MISMATCH`; incomplete evidence produces `UNKNOWN`; transport, authentication, unavailable scope, or incompatible response produces `UNAVAILABLE`. No FactuCore document endpoint is called. Unit/stub tests passed for the client route, schema rejection, match, and mismatch. Live QA was not executed because authorized runtime credentials with `tenant:read` were not proven in the running service.
