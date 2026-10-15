# Design: Administración de facturación electrónica por tenant

## Boundary

```text
SUPER_ADMIN browser
  -> Manus API administrative endpoints
  -> tenant-scoped configuration/audit repositories
  -> internal billing-backend HTTP contract
  -> FactuCore HTTP API
```

Manus owns authorization, tenant selection, fiscal issuer comparison, persistence of neutral configuration, and audit. `backend-facturacion-electronica` owns provider runtime, credential resolution, FactuCore requests, and provider response normalization. Manus never queries a FactuCore database.

Existing sale flow remains:

```text
POS -> API sale transaction + integration outbox -> billing backend inbox -> FactuCore
```

This change adds administration around that flow. It does not move the worker or alter historical documents.

## Data strategy

The repository currently contains `electronic_billing_providers` and `tenant_electronic_billing_configs` in `V072__electronic_billing_base_persistence.sql`, with the one-enabled-default invariant in `V088__electronic_billing_default_config_integrity.sql`. The first task is to compare those DDLs with the deployed schema and migration history. No new table or column is assumed.

The authorized QA schema also contains `encrypted_credentials TEXT`. Its provenance is `V089__tenant_electronic_billing_encrypted_credentials.sql`, historically introduced by commit `2dc2ed8159e40f7889911b97337465c6f11337a1`; the historical file SHA-256 is `5161f4bccdb8c3a239124a303410b4b6ffc9427718c7fd292679d137372fd620`, exactly matching the successful QA `migration_history` row. The migration artifact is absent at this branch base and the checked-in QA snapshot is stale. This is repository/schema drift, not evidence for a duplicate migration. No new migration is authorized in Phase 1.1.

Selected storage contract for Phase 2: new administrative credentials use `encrypted_credentials` with the proven historical format, AES-256-GCM version `v1`, while `credential_reference` remains a compatibility fallback resolved by the dedicated billing backend. No plaintext migration is allowed. The billing backend owns encryption, decryption, and provider credential resolution; the Manus API owns SUPER_ADMIN authorization and tenant/fiscal validation but never decrypts or returns secrets.

The encryption master key is external runtime configuration (`ELECTRONIC_BILLING_ENCRYPTION_KEY` or a compatible secret-manager binding), 32 bytes, outside the database, browser, repository, logs, and audit records. Missing, malformed, or unavailable key material fails closed. Current branch source does not prove that this key is wired in the billing runtime, so credential writes remain a Phase 2 prerequisite. Key rotation, versioning, and recovery evidence must be defined before production use.

## Administrative API shape

Names below are proposed contracts, not verified existing endpoints. Implement only after API conventions and the billing backend transport are confirmed.

- `GET /admin/tenants/:tenantId/electronic-billing/config`
- `PUT /admin/tenants/:tenantId/electronic-billing/config`
- `POST /admin/tenants/:tenantId/electronic-billing/config/connection-check`
- `GET /admin/tenants/:tenantId/electronic-billing/fiscal-identity`

All routes require authenticated `SUPER_ADMIN`. The server derives the target tenant from an allowlisted administrative selection and rechecks it against the actor's authority. Tenant IDs in the body do not override authorization. Responses contain provider, environment, enabled/default state, base URL policy-safe status, credential presence/reference status, FactuCore tenant identifier masked or non-secret, last check state, and timestamps. They never contain `clientSecret`, raw credential values, authorization headers, or raw provider payloads.

Credential writes accept secrets only on create/replace and return a write-once acknowledgement. A read returns `configured: true` and metadata only. Disable or identity mismatch blocks new billing configuration use; it does not rewrite historical documents.

## Identity validation

The connection check must prove, in order:

1. The configured provider is active and the environment is allowed.
2. The resolved credential belongs to the intended API client without exposing it.
3. FactuCore recognizes the configured `factuCoreTenantId` through a documented endpoint/response.
4. The returned fiscal identity matches the Manus tenant's authoritative fiscal profile (document type, normalized number, verification digit, and legal name according to the verified contract).

If FactuCore does not expose a tenant identity endpoint, stop and record the dependency as blocked. Do not infer identity from an invoice, do not issue a test document, and do not call a FactuCore database.

### Proposed FactuCore contract if approved by the FactuCore owner

This is a proposal only. It is not an existing route and MUST NOT be called until implemented and documented by FactuCore:

- `GET /api/v1/external/client-context`
- Authentication: existing `x-client-key` and `x-client-secret` headers; require a new least-privilege `tenant:read` scope. The API Client, not a request parameter, determines the tenant.
- Response DTO:

```json
{
  "apiClientId": "string",
  "tenantId": "uuid",
  "environment": "TEST | HABILITATION | PRODUCTION",
  "issuer": {
    "identificationTypeCode": "string",
    "identificationNumber": "string",
    "verificationDigit": "string | null",
    "legalName": "string"
  },
  "dianReadiness": {
    "status": "READY | NOT_READY | UNKNOWN",
    "failedChecks": [{ "code": "string", "path": "string | null" }]
  }
}
```

FactuCore must guarantee that `tenantId`, `issuer`, and readiness belong to the authenticated API Client context, that no client-supplied tenant selector is accepted, and that the response contains no credentials or raw certificate material. Manus must compare the response to its own tenant and fiscal profile before reporting readiness.

Independent work may proceed without this route: schema/repository read models, SUPER_ADMIN authorization, safe DTOs, audit contracts, billing-backend encryption and resolver tests, and frontend write-once form contracts. Readiness, production credential activation, and identity mismatch approval remain gated on the authenticated endpoint.

## Security and audit

Use existing JWT/role/permission and audit patterns. Audit records include actor, target tenant, action, outcome, correlation ID, provider code, environment, and sanitized reason. Secret values, `clientSecret`, credential JSON, auth headers, raw response bodies, and full provider payloads are forbidden in logs, audit metadata, outbox, and error messages. Add redaction around the current FactuCore client request/response logging before any administrative credential-check path is enabled.

## Phases and gates

1. Evidence: inspect governance, branch, migration history, deployed schema access, and the real FactuCore contract. Gate: every unresolved item is explicit; no schema or provider-contract assumption is hidden.
2. Database: reuse current tables and reconcile V089 provenance before any write path. Gate: exact checksum evidence, no duplicate migration, and external-key ownership accepted.
3. Backend Manus: SUPER_ADMIN endpoints, tenant isolation, safe DTOs, audit, and internal billing client. Gate: unit/integration tests with fake provider.
4. Billing backend: identity/status adapter and redaction. Gate: contract tests against a local stub or authorized non-production FactuCore only; never issue a document.
5. Frontend: section in the existing configuration wizard with masked/write-once credentials and read-only fiscal result. Gate: browser QA with principal tenant and KSOLECTRI fixtures.
6. Integration/QA: outbox compatibility, disabled/mismatch blocking, build/lint/OpenSpec strict. Gate: evidence package and explicit production approval.

## QA fixture boundary

The owner accepts shared KSOLECTRI credential configuration as a controlled QA fixture. It is not an incident blocker and must not be changed by this phase. The exception does not generalize to production: production readiness requires authenticated FactuCore tenant/API-client identity and issuer matching. Manus must never infer tenant ownership from credential reuse.
