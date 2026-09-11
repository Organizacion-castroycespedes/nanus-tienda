# Evidencia - FactuCore QA Local Runtime Readiness

Fecha: 2026-09-09.

## Estado

- Branch: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `7352ea7 feat(docs): add evidence for FactuCore QA environment enablement`.
- Estado inicial: limpio.
- Backend local: `http://127.0.0.1:4030`.
- Backend environment: `qa`.
- FactuCore local: `http://127.0.0.1:8000`.
- No se procesaron documentos y no se ejecutaron operaciones POST de facturación.

## Database hard guard

The billing backend loads `backend-facturacion-electronica/.env` through `dotenv` at startup. Its effective non-secret DB configuration is:

- `DB_HOST=54.242.102.178`.
- `DB_PORT=5432`.
- `DB_DATABASE=manus_tienda_qa`.
- `DB_USERNAME=manus_user`.
- `DB_SSL=false`.

The same values were used for the read-only guard:

- `current_database`: `manus_tienda_qa`.
- `current_user`: `manus_user`.
- `current_schema`: `public`.
- DB server: `172.26.15.126:5432`.
- Result: PASS.

All ten required billing tables exist in `public`: providers, tenant configs, documents, lines, taxes, references, events, attachments, deliveries, and inbox events. Schema guard: PASS. No migrations executed.

## Tenant and document guards

- Tenant: `00000000-0000-0000-0000-000000000001`.
- Provider config ID: `22222222-2222-4222-8222-222222222222`.
- Provider: `FACTUCORE`.
- Environment: `TEST`.
- Enabled: true.
- Default: true.
- Base URL: `http://127.0.0.1:8000`.
- Base URL source: `tenant_electronic_billing_configs.base_url`.
- Credential reference: `env:FACTUCORE_TENANT_QA`.

Candidate before and after validation:

- ID: `7fa040a9-0703-434d-954c-5f348f2d6544`.
- Sale ID: `966060ae-3cd8-4a85-a4f0-33912cfbd295`.
- Status: `PENDING`.
- `provider_document_id`: NULL.
- `provider_status`: NULL.

There are 2 `PENDING`, 0 `PROCESSING`, and 0 `TECHNICAL_ERROR` documents. Other pending document was not touched. No provider document was created.

## Resolver checks

- `EnvironmentElectronicBillingCredentialResolver`: resolved `FACTUCORE_TENANT_QA`; JSON parsed; `clientKey` and `clientSecret` were non-empty. Values were not printed.
- `ElectronicBillingProviderResolver`: returned `FactuCoreProvider`, code `FACTUCORE`, environment `TEST`, base URL `http://127.0.0.1:8000`, and the expected credential reference.
- Resolver result: PASS.
- `FactuCoreClient` direct `process.env` access: NO.
- `FISCAL_PROVIDER=MOCK_LOCAL` impact on tenant-driven electronic billing: NONE; new flow selects provider from tenant DB configuration.
- `FACTUCORE_BASE_URL` environment variable: absent and unused by the tenant-based flow.

## Runtime and health

The backend was restarted locally only. Startup loaded 35 values from `.env` and logged:

`Electronic billing background sync disabled`

- Backend `GET /health`: HTTP 200, environment `qa`.
- FactuCore `GET /api/health`: HTTP 200, `{"status":"ok"}`.
- FactuCore readiness: HTTP 503, `El endpoint de readiness no está configurado`; this is not classified as provider failure.
- Unauthenticated `GET /api/v1/external/documents`: HTTP 401; auth guard: PASS.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`: worker DISABLED.
- API outbox dispatcher: not enabled; remains DISABLED.
- Eager FactuCore requests at billing startup: 0.

## Authenticated smoke safety gate

Authenticated read-only smoke was NOT EXECUTED. The current local credential was exposed during an inspection command, so it cannot be treated as the required current rotated credential. No authenticated FactuCore request was sent afterward. A newly rotated/regenerated client secret must replace the exposed value before testing `GET /api/v1/external/documents`.

No provider mutation occurred:

- Create invoice calls: 0.
- Generate XML calls: 0.
- Sign calls: 0.
- Transmit calls: 0.
- Retry-transmission calls: 0.

## Secret scan

- Secret values are not present in this evidence, OpenSpec artifacts, tracked repository files, or backend logs observed.
- `DB_PASSWORD`, `clientKey`, and `clientSecret` values were not intentionally copied into evidence.
- Secret error leak: FOUND in inspection output; rotate/regenerate the FactuCore client credential before any authenticated smoke.

## Validation

- Backend tests: PASS, 120 tests.
- Backend build: PASS.
- OpenSpec: not completed. PowerShell wrapper was blocked by execution policy; direct CLI invocation produced no result in the available shell.
- `git diff --check`: PASS.
- Runtime config was already QA-configured; local backend restart completed. No productive code changed.
- QA touched: YES, local backend restart only.
- PROD touched: NO.
- Commit: NO. Push: NO. PROD deploy: NO.

## Outcome

QA DB runtime is ready. Provider and credential resolver wiring is ready. Authenticated FactuCore access is not certified because the credential must be rotated after exposure. Keep the global billing worker disabled. Do not process the candidate in this phase.
