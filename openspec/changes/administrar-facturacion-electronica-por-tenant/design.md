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

Selected storage contract for Phase 2: new administrative credentials use `encrypted_credentials` with AES-256-GCM format `v2`, while `credential_reference` remains a compatibility fallback resolved by the dedicated billing backend. The `v2.<keyId>.<nonce>.<tag>.<ciphertext>` envelope uses a random 12-byte nonce, a 16-byte authenticated tag, and authenticated additional data binding `tenantId`, `providerConfigId`, and `providerId`. The historical later-commit format `v1` has no key identifier or binding and is intentionally unsupported by this foundation; existing QA ciphertext is not decrypted or overwritten. No plaintext migration is allowed. The billing backend owns encryption, decryption, and provider credential resolution; the Manus API owns SUPER_ADMIN authorization and tenant/fiscal validation but never decrypts or returns secrets.

The encryption master key is external runtime configuration. The implementation supports a key ring in `ELECTRONIC_BILLING_ENCRYPTION_KEYS` with `ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID`; the historical single-key `ELECTRONIC_BILLING_ENCRYPTION_KEY` remains a compatibility input. Every key is 32 bytes. New ciphertext uses the active key; historical key IDs remain available for decryption during rotation. Keys stay outside the database, browser, repository, logs, and audit records. Missing, malformed, unknown, or unavailable key material fails closed. Operational secret-manager provisioning, rotation approval, escrow, and recovery ownership remain required before production credential writes.

Tenant credential writes also require the explicit runtime gate `ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED=true`; its default is disabled. A present key without approved operational ownership does not enable persistence.

HU-EB-E2E-001A.1 adds `V106__electronic_billing_configuration_audit.sql` because the Billing
Backend had no configuration-audit table. The Billing Backend writes the configuration row and its
sanitized audit row in one PostgreSQL transaction. The audit stores no credentials or ciphertext;
it stores tenant/config IDs, action, fixed proxy actor source, environment and provider ID.
Metadata-only updates pass `NULL` for the encrypted value so the previous ciphertext remains intact.
Credential replacement allocates or reuses the configuration ID before encrypting, binding AAD to
the exact tenant/provider/configuration identity. The migration is not applied by this phase.

## Administrative API shape

The implementation adds one verified mutation to the existing internal/admin transport:

- `POST /admin/electronic-billing/tenants/:tenantId/config/:configId/activate`
- Body: `{ "clearLegacyReference": true }` is generated only by the authenticated Manus API after explicit UI confirmation.
- The Manus API requires `SUPER_ADMIN`, existing electronic-billing `WRITE`, tenant existence, selected-config identity, and `MATCH` from the existing read-only FactuCore context operation.
- Billing locks the tenant and selected configuration, validates active FactuCore plus V2 ciphertext and tenant binding, clears competing defaults, enables/defaults the selected row, clears the legacy reference, preserves ciphertext, and writes `CONFIG_METADATA_UPDATED` audit metadata with transition `ACTIVATED_AND_DEFAULTED`.
- The unique partial index remains the final concurrent-default guard. No migration is needed.

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

## HU-EB-E2E-001B frontend editor gate

The existing tenant wizard now provides a tenant-scoped local editing draft for provider, environment, base URL, `settings.factuCoreTenantId`, and write-only FactuCore API Client fields. Stored credentials are never loaded into the draft. Empty credential fields mean “preserve the stored credential”; they do not mean deletion. The browser performs only local validation and uses the existing read-only `factucore-context` action for identity validation.

The Save control remains disabled because the current MANUS API has no authoritative read-only write-readiness contract. The UI must not infer readiness from a hardcoded flag, configuration status, or DIAN readiness. The readiness endpoint is the backend authority: exact QA requires V106 availability, active V2 keyring, and synthetic self-test; non-QA additionally requires the enabled write gate and existing operational approval. The backend continues returning sanitized `503` while the applicable gates are unresolved.

## HU-EB-ENC-001 encrypted credential enrollment

The existing tenant editor now reads `GET /api/admin/electronic-billing/runtime/crypto-readiness` through the Manus API. The browser never calls the Billing Backend directly. The response is an allowlisted DTO containing schema migration state, keyring status, synthetic self-test, historical decrypt state, operational ownership/recovery state, the explicit credential-write gate, and `writeReady`; it contains no secret material or key identifiers. The Save button is enabled only when the backend reports `writeReady` and local validation passes.

When a target tenant has no configuration, the same editor enters initial-creation mode from its empty state. It uses the existing authenticated `POST /admin/electronic-billing/tenants/:tenantId/config` route, requires the complete create contract including both write-only credentials, and refreshes the safe configuration read after success. No separate form, fallback credential source, or direct Billing request is introduced.

The administrative FactuCore identity operation uses a separate read-only resolver method. It selects the requested tenant's FactuCore configuration without requiring `enabled` or `is_default`, then reuses the normal provider and credential resolution with the exact tenant/provider/configuration binding. The sale, outbox, retry, and dispatch resolver keeps the existing enabled-and-default requirements.

Existing tenant `POST`/`PATCH` routes remain the only write contract. Billing Backend encrypts credentials before persistence with tenant/provider/configuration AAD, preserves ciphertext on metadata-only updates, and writes the sanitized audit event in the same transaction. In the exact `NODE_ENV=qa` runtime, `writeReady` requires verified schema migration, active V2 keyring, and passing synthetic self-test; the reported `credentialWrites` field still reflects the actual environment flag, but that manual deployment flag is not required for QA enrollment. Outside QA, the explicit write gate and existing operational approval requirements remain mandatory. No frontend or client-side signal can bypass the backend decision.

### QA credential-write usability

QA tenant enrollment may proceed through the existing authenticated `SUPER_ADMIN` tenant-scoped `POST`/`PATCH` routes when schema migration, keyring, and synthetic self-test are `READY`/`PASS`. This is an exact-environment policy, not a general approval bypass: production and every non-QA environment retain the explicit credential-write flag and existing approval gates. AES-256-GCM v2, tenant/provider/configuration AAD, atomic V106 audit, write-only secrets, and fail-closed behavior are unchanged.

HU-EB-ENC-002E adds a read-only schema probe to the existing Billing Backend readiness operation. The probe verifies the configured database identity, the successful `V106__electronic_billing_configuration_audit.sql` history row and exact checksum, the expected audit-table columns, and both declared indexes. Database errors, identity mismatches, missing history/table state, or checksum/schema inconsistencies remain non-ready (`UNKNOWN` or `MISSING`) and never enable credential writes. Operational ownership and independent recovery evidence remain `UNKNOWN` unless supplied by an approved external custody process; synthetic AES readiness does not prove historical V1 decryptability.

## Phase 2B implemented read contracts

Manus exposes these read-only routes under the global `/api` prefix:

- `GET /api/admin/electronic-billing/providers`
- `GET /api/admin/electronic-billing/tenants/:tenantId/config`

Both routes use the existing `JwtAuthGuard` and `RolesGuard`, with class-level `@Roles("SUPER_ADMIN")`. The target tenant is validated against the `tenants` table on every configuration request. No tenant from a body, header, or session context overrides the route parameter. Non-admin users are rejected by the existing role guard.

Manus calls the billing backend through the existing `BillingIntegrationClient` and `Authorization: Bearer API_INTERNAL_TOKEN` service-to-service contract. The billing backend exposes the matching internal routes:

- `GET /internal/electronic-billing/admin/providers`
- `GET /internal/electronic-billing/admin/tenants/:tenantId/config`

The billing read projection returns only provider catalog metadata, environment, enabled/default state, base URL presence, credential presence booleans, and the configured `factuCoreTenantId`. It never returns `encrypted_credentials`, `credential_reference`, key IDs, raw credentials, or exception details. The SQL projection reads only boolean presence for both credential columns. It does not decrypt ciphertext.

Credential INSERT and REPLACEMENT now consume the same authoritative fail-closed readiness decision as the protected readiness DTO. The decision requires V106 schema readiness, AES v2 keyring and self-test readiness, the explicit server write gate, and trusted operational ownership plus recoverable-backup approval. The default approval provider returns `UNKNOWN`; no frontend field or ordinary environment flag can manufacture approval. Metadata-only updates do not require credential-write approval and preserve prior ciphertext. No real QA enrollment is enabled until an approved evidence provider exists.

## HU-EB-ENC-006 operational evidence boundary

The current repository has no verified authoritative operational-attestation source. `security_audit_logs` and `auditoria_eventos` are generic application audit records; they do not provide a durable, validated record for key ID, environment separation, independent recovery verification, expiry, revocation, or distinct operator/approver identities. The V106 billing audit is scoped to configuration mutations and is not an approval ledger. Their asynchronous or mutation-scoped semantics cannot safely feed credential-write readiness.

Therefore the existing `DefaultElectronicBillingOperationalApproval` remains the only production provider and deliberately returns `UNKNOWN` for both ownership and recovery. Synthetic test providers are dependency overrides only. No database migration, environment flag, frontend claim, or prior backup-file presence may produce `APPROVED`. This keeps credential INSERT/REPLACEMENT fail-closed and preserves metadata-only updates.

The minimum future implementation is a separately authorized, authenticated QA attestation contract with durable storage: operator and (where required) independent approver identities, environment, active key ID, non-secret evidence reference/fingerprint, independently verified recovery status, issued/expiry timestamps, and revocation fields. It must enforce QA/production separation, reject stale/revoked/mismatched evidence, and be consumed by the same shared readiness decision after restart. Designing or applying that storage is outside this safe implementation because no existing trusted source or approved schema is present.

HU-EB-ENC-007 adds only the safe persistence boundary. `V107__electronic_billing_keyring_operational_approvals.sql` defines one QA-only approval ledger with non-secret identity/evidence metadata, active-key binding, independent verification statuses, expiry, revocation, role-separation checks, and a unique active approval per environment/key. The Billing Backend reader queries only the current active key, accepts exactly one valid non-expired non-revoked row, and returns `UNKNOWN` on missing rows, duplicates, mismatches, invalid evidence, or database errors. It never reads key material or backup contents.

No authenticated approval or revocation route is implemented by HU-EB-ENC-007. Existing `SUPER_ADMIN` authentication and `API_INTERNAL_TOKEN` prove request/service identity, but no validated mechanism proves that a recovery test was independently performed. Therefore no row can be created by the application, the default remains fail-closed, and the write gate remains disabled until a separately approved evidence-verification workflow exists.

## HU-EB-ENC-009 QA policy

For the explicitly selected local QA runtime only, the shared write-readiness decision accepts the existing verified operational prerequisites without V107 attestation: `NODE_ENV=qa`, V106 schema readiness, AES v2 keyring readiness, synthetic self-test `PASS`, and `ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED=true`. It does not change `operationalOwnership` or `recoveryReadiness` in the DTO; those remain `UNKNOWN`. Production and every non-QA environment still require both durable approvals from V107. No new environment variable is introduced, and no frontend value can change the decision.

This is a QA delivery policy, not proof of production key custody or FactuCore identity. V107 remains unapplied and excluded from this delivery. New writes are still write-only AES v2 replacements, tenant/provider/config AAD-bound, transactionally audited by V106, and never fall back from v2 to `credential_reference`. Existing metadata-only updates remain safe. Real QA credential replacement still requires a separate operator action with approved credentials and ownership validation.

## HU-EB-ENC-008 workflow boundary

The verified Manus identity model exposes the authenticated user identity through `request.user.id` and roles through `request.user.roles`. `RolesGuard` can require `SUPER_ADMIN`, and `PermissionsGuard` can require `ELECTRONIC_BILLING_PROVIDERS` `WRITE`; however, `SUPER_ADMIN` currently bypasses the permission lookup and there is no existing role or service that independently verifies key-backup recovery evidence. `API_INTERNAL_TOKEN` authenticates the Billing Backend boundary, not a human approver.

V107 intentionally requires three distinct identities: key owner, recovery verifier, and final approver. The available second administrator is not enough until the actual accounts, roles, permission, and separation are verified. No workflow endpoint is added here. A future workflow must derive all identities from authenticated sessions, reject self-verification and self-approval, require a trusted evidence-verification source, persist transitions atomically, and call the existing reader/readiness policy. Frontend claims, checkbox values, free text, and environment flags remain invalid approval sources.

The stable safe configuration DTO is:

```json
{
  "tenantId": "uuid",
  "configurations": [{
    "id": "uuid",
    "tenantId": "uuid",
    "providerId": "uuid",
    "providerCode": "string",
    "providerName": "string",
    "providerActive": true,
    "environment": "TEST | HABILITATION | PRODUCTION",
    "enabled": false,
    "isDefault": false,
    "configurationStatus": "COMPLETE | INCOMPLETE | INCONSISTENT",
    "baseUrlConfigured": true,
    "credentialStatus": {
      "encryptedConfigured": true,
      "legacyReferenceConfigured": false
    },
    "settings": { "factuCoreTenantId": "string | null" }
  }]
}
```

This DTO reports configuration state only. It does not report connection readiness or FactuCore identity verification.

## Phase 3A implemented read-only wizard view

The existing `web/app/[tenant]/configuracion/page.tsx` tenant edit wizard now has a `Facturación electrónica` step before `Revisión`. The step is rendered only for `SUPER_ADMIN`; existing `SUPER_USER` configuration access does not receive this section.

The browser uses the existing authenticated `apiClient` and calls only the Manus API routes. It never calls the billing backend or FactuCore directly. The view renders the provider catalog and safe configuration metadata: provider, environment, enabled/default state, base URL presence, encrypted/legacy credential presence, `configurationStatus`, and the configured `settings.factuCoreTenantId`. `COMPLETE` means configuration completeness only; it is not FactuCore identity or DIAN readiness.

The component resets tenant data before each load, uses `AbortController`, and ignores stale completions. It renders loading, denied, network-error, empty, and inconsistent states. A defensive read-model projection copies only approved DTO fields, so secrets, references, ciphertext, key IDs, headers, and raw provider payloads are not rendered. No POST, PUT, PATCH, DELETE, credential form, connection test, activation, or issuance action is present.

Phase 3A does not implement credential writes, rotation, or activation. Phase 3A now has a read-only identity validation action backed by the verified FactuCore client-context contract. It remains a configuration/readiness observation only; it does not prove DIAN acceptance.

## Phase 4 read-only FactuCore identity contract

FactuCore exposes `GET /api/v1/external/client-context` (also `/external/client-context`) behind `ApiClientAuthGuard`, `ApiClientRateLimitGuard`, `ApiClientScopesGuard`, and `tenant:read`. MANUS uses only `/api/v1/external/client-context` through `FactuCoreClient`; the browser never sends FactuCore credentials.

The billing backend reads the tenant-scoped enabled provider configuration through `ElectronicBillingProviderResolver`, resolves encrypted v2 credentials or the legacy environment reference, and calls the endpoint without a document operation. The internal route is `GET /internal/electronic-billing/admin/tenants/:tenantId/factucore-context`, protected by the existing `API_INTERNAL_TOKEN`. MANUS exposes `GET /api/admin/electronic-billing/tenants/:tenantId/factucore-context`, protected by `JwtAuthGuard`, `RolesGuard`, and `SUPER_ADMIN`, and checks target tenant existence.

The response carries only the verified FactuCore safe context DTO: API client ID, effective tenant ID, environment, redacted issuer identity, resolution status/count metadata, and `dianReadiness` with `READY`, `NOT_READY`, or `UNKNOWN` and `basis: CONFIGURATION_ONLY`. MANUS computes `MATCH`, `MISMATCH`, `UNKNOWN`, or `UNAVAILABLE`: tenant mapping and normalized issuer (`nit`, `dv`, legal name) must match for `MATCH`; transport/authentication failure is `UNAVAILABLE`; incomplete evidence is `UNKNOWN`; conflicting identity is `MISMATCH`. The outcome is ephemeral. No credentials, ciphertext, keys, raw headers, raw provider payloads, or readiness secrets are returned or logged.

## Runtime DI correction evidence

The administrative controller regression was traced to two verified facts in the API runtime path: `ElectronicBillingAdminService` was registered in `ElectronicInvoicingModule` without `@Injectable()`, and the development `tsx` transpilation path did not provide constructor type metadata for implicit injection. Nest therefore created `ElectronicBillingAdminController` without its service argument instead of rejecting module startup.

The minimum compatible correction adds `@Injectable()` to `ElectronicBillingAdminService`, explicit `@Inject(DatabaseService)` and `@Inject(BillingIntegrationClient)` to its constructor, and explicit `@Inject(ElectronicBillingAdminService)` to the controller constructor. Existing module ownership, guards, routes, DTOs, and error handling remain unchanged.

## Protected Billing Backend crypto runtime diagnostic

Billing Backend exposes `GET /internal/electronic-billing/admin/runtime/crypto-readiness`
only through the existing `API_INTERNAL_TOKEN` bearer convention. The response is metadata
only and is not proxied by MANUS or exposed to the browser. It returns an allowlisted keyring
status, synthetic crypto self-test status, `historicalDecryptReady: UNKNOWN`, and the current
credential-write gate state. It never returns key identifiers, key material, ciphertext,
environment values, credentials, or stack traces. The synthetic self-test does not prove that
historical tenant ciphertext can be decrypted; historical readiness remains `UNKNOWN` until a
separately approved controlled diagnostic exists.

The route uses `Cache-Control: no-store` and fails closed when the internal token is missing or
invalid. It reuses `inspectElectronicBillingCredentialRuntimeReadiness()` and does not alter
credential resolution precedence, POS issuance, database state, or the write gate.

## Future mutation contracts, not implemented

The future API may add `PUT /api/admin/electronic-billing/tenants/:tenantId/config` with provider/environment/settings metadata and write-only credential input, plus explicit key rotation and activation actions. Those actions require external key ownership, historical ciphertext compatibility/upgrade policy, audit, fail-closed behavior, and the authenticated FactuCore `client-context` contract. No route, service method, or DTO in Phase 2B performs those actions. No production activation is possible from the read layer.

## HU-EB-ENC-010 PATCH UUID compatibility correction

The observed `PATCH /api/admin/electronic-billing/tenants/:tenantId/config/:configId`
request was rejected in the Billing Backend before repository access. The service reused
the strict RFC 4122 provider-ID pattern for the tenant ID and configuration ID. The QA
principal tenant identifier `00000000-0000-0000-0000-000000000001` is a valid project UUID
shape used by Manus but has no RFC 4122 version/variant bits, so the request was classified
as a sanitized `400` validation error.

The minimum correction uses a generic UUID-shape validator for `tenantId` and `configId`
only. Provider catalog IDs continue using the strict provider-ID validator. Credential
pair validation, tenant/config ownership lookup, V2 AAD binding, atomic V106 audit, and
all write-readiness gates remain unchanged. This correction does not replay or accept
the exposed credentials and does not enable any new runtime behavior by itself.
## HU-EB-E2E-001A: tenant credential write gate

Tenant configuration writes use `POST /api/admin/electronic-billing/tenants/:tenantId/config`
and `PATCH /api/admin/electronic-billing/tenants/:tenantId/config/:configId`, proxied to the
authenticated Billing Backend. Requests accept only provider/environment/settings and dedicated
write-only `clientKey`/`clientSecret` fields. New configurations are forced to `enabled=false`
and `is_default=false`; no activation or document operation is part of this capability.

The Billing Backend encrypts credentials with the existing AES-256-GCM v2 envelope and AAD binding
(`tenantId`, `providerId`, `providerConfigId`). It must fail closed when the external keyring,
active key, historical recovery keys, rotation ownership, or recovery procedure is not operationally
proven. Until that gate is satisfied, the routes validate shape and authorization but return sanitized
503 and perform no database write. Legacy `credential_reference` is never created or used as a
fallback for a submitted write.
