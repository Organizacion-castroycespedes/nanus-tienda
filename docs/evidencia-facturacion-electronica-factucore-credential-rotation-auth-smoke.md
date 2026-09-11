# Evidencia - FactuCore Credential Rotation + Authenticated Read-only Smoke

Fecha: 2026-09-09.

## Repository and scope

- Branch: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `7352ea7 feat(docs): add evidence for FactuCore QA environment enablement`.
- Initial status: clean.
- Only local QA billing runtime was restarted.
- No invoice, XML, signing, transmission, retry, document processing, PROD access, commit, push, or deployment.

## FactuCore client rotation

- FactuCore runtime: local `http://127.0.0.1:8000`.
- API client found: YES.
- API client ID: `60cbac48-f476-4f34-9664-6ba27df95d23`.
- API client name: `Api Shirley`.
- Client key identified: YES, value withheld.
- Client active: YES.
- Client scopes include `documents:read`.
- Rotation mechanism: FactuCore `ApiClientsService.regenerateSecret`, supported by `POST /api/api-clients/:id/regenerate-secret`.
- Exactly one secret rotation executed.
- New credential stored in tracked file: NO.
- New credential stored in DB: NO; DB stores only the neutral reference.
- New credential stored in local ignored env: YES.
- Old credential invalidated: ASSUMED FROM ROTATION / NOT RETESTED.

## QA runtime and provider configuration

- Backend: local `http://127.0.0.1:4030`.
- Backend environment: `qa`.
- QA database: `manus_tienda_qa`.
- DB hard guard after restart: PASS (`manus_tienda_qa`, `manus_user`, `public`).
- DB server: `172.26.15.126:5432`.
- Tenant: `00000000-0000-0000-0000-000000000001`.
- Provider config ID: `22222222-2222-4222-8222-222222222222`.
- Provider: `FACTUCORE`.
- Provider environment: `TEST`.
- Provider enabled/default: YES/YES.
- Provider base URL: `http://127.0.0.1:8000`.
- Base URL source: `tenant_electronic_billing_configs.base_url`.
- Credential reference unchanged: `env:FACTUCORE_TENANT_QA`.

## Resolver and startup checks

- Credential env present: YES.
- Credential JSON valid: PASS.
- `clientKey` present/non-empty: YES.
- `clientSecret` present/non-empty: YES.
- `EnvironmentElectronicBillingCredentialResolver`: PASS.
- `ElectronicBillingProviderResolver`: PASS; resolved `FactuCoreProvider` with `TEST`, local base URL, and expected reference.
- Backend health after restart: HTTP 200, `environment=qa`.
- Startup log: `Electronic billing background sync disabled`.
- Background worker: DISABLED.
- API dispatcher: DISABLED.
- FactuCore health: HTTP 200, `{"status":"ok"}`.
- FactuCore readiness: NOT CONFIGURED (HTTP 503; not classified as provider failure).
- Unauthenticated external API guard: HTTP 401, PASS.

## Authenticated read-only smoke

- Request: exactly one `GET /api/v1/external/documents`.
- Authentication headers: sent from local runtime only; values withheld.
- Result: HTTP 200.
- Response type: JSON array.
- Response document count: 9.
- FactuCore authentication: PASS.
- No response payload or fiscal PII copied into evidence.

## Mutation and candidate guards

- FactuCore GET calls: 1 authenticated document-list call, plus health checks.
- Create invoice calls: 0.
- Create credit-note calls: 0.
- Create debit-note calls: 0.
- Generate XML calls: 0.
- Sign calls: 0.
- Transmit calls: 0.
- Retry-transmission calls: 0.
- New FactuCore documents from this phase: 0.

Candidate after smoke:

- Document: `7fa040a9-0703-434d-954c-5f348f2d6544`.
- Sale: `966060ae-3cd8-4a85-a4f0-33912cfbd295`.
- Status: `PENDING`.
- `provider_document_id`: NULL.
- `provider_status`: NULL.
- Other pending documents touched: NO.
- Current Manus QA inventory: 2 `PENDING`, 0 `PROCESSING`, 0 `TECHNICAL_ERROR`.

## Secret hygiene

- New secret in tracked files: NO.
- New secret in DB: NO.
- New secret in logs: NO.
- New secret in evidence/OpenSpec: NO.
- DB password in output/evidence: NO.
- Secret error leak for new credential: NONE.
- Historical exposed credential remains revoked/compromised and was not reused for authenticated HTTP.

## Validation

- Backend tests: PASS, 120 tests.
- Backend build: PASS.
- OpenSpec relevant change: PASS, `integrar-facturacion-electronica-multiproveedor` strict.
- OpenSpec all strict: PASS, 80 items.
- `git diff --check`: PASS.
- Migrations executed: NO.
- QA touched: YES.
- PROD touched: NO.
- Code modified: NO productive code.
- Runtime config modified: YES, ignored local credential value replaced after rotation.
- Commit: NO.
- Push: NO.
- PROD deploy: NO.

## Outcome

Credential rotation and authenticated read-only access passed. Global worker remains disabled. Controlled single-document provider QA is the next phase; do not process the candidate in this phase.
