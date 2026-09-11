# Evidencia - FactuCore QA Environment Enablement

Fecha de verificación: 2026-09-08.

## Alcance y seguridad

- Fase: configure + verify FactuCore QA environment.
- No se procesaron documentos.
- No se generó XML, no se firmó y no se transmitió.
- No se hizo ninguna llamada HTTP autenticada a FactuCore.
- No se tocó PROD.
- No se ejecutaron migraciones.
- No se modificó código productivo ni el runtime. Esta evidencia contiene únicamente verificaciones read-only.

## Estado inicial

- Branch: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `22cbc9b Refactor code structure for improved readability and maintainability; remove redundant code blocks and optimize existing functions.`
- `git status --short`: limpio.

## QA database guard

- `current_database()`: `manus_tienda_qa`.
- `current_user`: `manus_user`.
- `current_schema()`: `public`.
- DB server: `172.26.15.126:5432`.
- Resultado: PASS.

## Electronic document inventory

- PENDING: 2.
- PROCESSING: 0.
- TECHNICAL_ERROR: 0.
- Candidate `7fa040a9-0703-434d-954c-5f348f2d6544`: `PENDING`.
- Candidate sale ID (`source_id`): `966060ae-3cd8-4a85-a4f0-33912cfbd295`.
- Candidate `provider_document_id`: NULL.
- Candidate `provider_status`: NULL.
- Second pending document: `da862163-c4f3-44c8-92cf-066afc9abcbb`, sale ID `2bcbf62c-3b93-43ad-a047-45800cc93bf1`.
- Candidate and second document were not modified.

## FactuCore environment discovery

- Authoritative source inspected: `D:/Profe/Factucore/README.md`, `D:/Profe/Factucore/backend/src/modules/documents/external-documents.controller.ts`, and the integration guide artifact in `backend-facturacion-electronica/FactuCore/`.
- FactuCore QA/Sandbox environment exists: UNKNOWN.
- Source of truth does not identify a QA/Sandbox deployment or base URL.
- The available FactuCore `.env` is local `development` configuration with `DIAN_ENVIRONMENT=habilitacion`; it is not a QA/Sandbox runtime contract.
- FactuCore environment: UNKNOWN. No PROD URL was used.
- FactuCore QA/Sandbox base URL: not available.

## FactuCore contract review

Available external v1 routes use `/api/v1/external/documents`.

- Mutating: `POST /invoices`, `POST /credit-notes`, `POST /debit-notes`, `POST /:id/generate-xml`, `POST /:id/sign`, `POST /:id/transmit`, and `POST /:id/retry-transmission`.
- Non-mutating: `GET /`, `GET /:id`, `GET /by-external-reference/:externalReference`, `GET /by-number/:fullNumber`, `GET /:id/status`, `GET /status/by-external-reference/:externalReference`, `GET /:id/operations`, `GET /:id/timeline`, and existing-attachment downloads.
- These GET routes generally require an existing provider document or reference. No fabricated provider record was used.
- No authenticated non-mutating endpoint was safely executable because the QA/Sandbox base URL and credentials are unavailable.
- A FactuCore `/health` route was not used as an authentication test. If present and unauthenticated, it proves only network/service reachability.

## Tenant provider configuration

- Tenant: `00000000-0000-0000-0000-000000000001`.
- Provider code: `FACTUCORE`.
- Provider active: true.
- Tenant config enabled: true.
- Tenant config environment: `TEST` (does not satisfy QA/Sandbox gate).
- Tenant config base URL: blank.
- Credential reference: `env:FACTUCORE_TENANT_QA`.
- Credential reference syntax: PASS (`env` scheme and valid environment-variable name).
- Provider registry/resolver path exists and registers `FACTUCORE`; runtime resolution remains not ready because the tenant config has no usable QA URL and the credential is absent.

## Runtime credential and URL

- `FACTUCORE_TENANT_QA` in current billing runtime: missing.
- Real QA secret configured: NO.
- Secret source: runtime environment (not configured in this workspace/runtime).
- FactuCore QA base URL configured: NO.
- No secret was printed, stored, or copied into Git, tracked `.env`, documentation, OpenSpec, database, or evidence.
- DB stores only the neutral reference; no credential value was selected or displayed.
- QA credential / QA URL consistency: NOT TESTABLE.

## Billing backend and dispatcher safety

- `GET http://localhost:4030/health`: HTTP 200, service `backend-facturacion-electronica`.
- Live process environment reported `development`, not QA; therefore this is not evidence of a restarted QA runtime.
- Billing worker: disabled by source default (`ELECTRONIC_BILLING_BACKGROUND_ENABLED=false` is the required safety setting; no enablement was performed).
- API outbox dispatcher: disabled by source default (`INTEGRATION_OUTBOX_DISPATCHER_ENABLED=false`; no enablement was performed).
- Eager FactuCore HTTP during inspected startup path: 0 observed; provider bootstrap only registers the provider.
- Billing backend QA restart: not performed because QA runtime credentials and URL were unavailable.

## Client and credential hygiene review

- `FactuCoreClient` does not access `process.env` directly: NO direct access found.
- Credential resolver reads the environment only through the configured reference and validates JSON shape.
- `clientKey` present: NO (runtime variable missing).
- `clientSecret` present: NO (runtime variable missing).
- Credential resolution: FAIL.
- FactuCore credential shape: FAIL / not testable without the runtime variable.
- Provider resolution: FAIL for QA enablement; static `FACTUCORE` registration is present.
- Secret value in database: NO.
- Secret value in repo: NO.
- Secret value in docs/OpenSpec/evidence: NO.
- Secret value in logs: NO observed.
- Secret error leak: NONE observed.

## Provider state guard

- Safe authenticated smoke: NOT AVAILABLE.
- FactuCore connectivity: NOT SAFELY TESTABLE.
- FactuCore authentication: NOT SAFELY TESTABLE.
- FactuCore HTTP request count: 0.
- FactuCore documents created: 0.
- XML generated: 0.
- Documents signed: 0.
- Documents transmitted: 0.

## Outcome

The enablement is blocked by two missing runtime inputs: a documented QA/Sandbox FactuCore base URL and the real QA credential payload in `FACTUCORE_TENANT_QA`. The tenant database record also remains `TEST` with a blank `base_url`, so no authenticated provider smoke is permitted.

Next phase remains: manual `ProcessingService` invocation by document ID, only after the QA environment gate passes. The global billing worker must remain disabled.

Runbook update: not required; `docs/runbook-cutover-backend-facturacion-electronica.md` already describes the expected disabled-worker and environment-reference controls.
