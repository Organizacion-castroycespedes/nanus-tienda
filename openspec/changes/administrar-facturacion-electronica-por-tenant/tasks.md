## 1. Evidence and governance gate

- [x] 1.1 Confirm branch, base HEAD, clean status, and no unrelated worktree changes before implementation.
- [x] 1.2 Inventory existing OpenSpec billing changes and map every new requirement to this change without duplicating runtime ownership.
- [x] 1.3 Produce a read-only schema drift report for `V072`, `V088`, migration history, and the target non-production database; stop if access or drift evidence is missing.
- [x] 1.4 Obtain and record the real FactuCore administrative identity/status contract, endpoint, authentication scope, and response fields; stop if not proven.
- [x] 1.5 Investigate the KSOLECTRI incident through authorized, sanitized comparisons of Manus tenant fiscal identity, `credential_reference`, API-client identity, and FactuCore tenant identity; do not print secrets or issue documents.
- [x] 1.6 Reconcile QA `V089__tenant_electronic_billing_encrypted_credentials.sql` provenance and checksum against Git history; record current-branch artifact and snapshot drift without creating a duplicate migration.
- [x] 1.7 Record the owner-accepted KSOLECTRI shared-credential QA fixture and its production boundary.
- [x] 1.8 Select `encrypted_credentials` AES-256-GCM v1 plus external key ownership for new writes, retaining `credential_reference` fallback; leave runtime key wiring as a Phase 2 gate.

## 2. Database and secret boundary

- [x] 2.1 Reuse current provider/config tables and document why no migration is needed; V089 is already applied in QA and no duplicate migration is authorized.
- [ ] 2.2 Add repository queries that always scope configuration reads and writes by target `tenant_id` and preserve the enabled-default uniqueness invariant.
- [ ] 2.3 Define safe configuration/status DTOs that exclude raw credentials, `clientSecret`, auth headers, and raw provider payloads.
- [ ] 2.4 Define write-once credential replacement semantics compatible with `credential_reference` and environment resolution.
- [ ] 2.6 Restore or otherwise reconcile the V089 migration artifact and checked-in schema snapshot through an approved repository change; do not fabricate a replacement migration.
- [ ] 2.7 Verify billing-backend key injection, rotation/versioning, recovery ownership, and fail-closed behavior before enabling credential writes.
- [x] 2.5 Add secret-redaction utilities and tests for request logs, response logs, exceptions, audit metadata, outbox payloads, and error messages.

## 3. Manus API administration

- [ ] 3.1 Add a tenant electronic-billing administration module and register it without changing POS issuance behavior.
- [ ] 3.2 Implement SUPER_ADMIN-only routes for safe configuration read/write, connection check, and read-only fiscal identity lookup after route conventions are verified.
- [ ] 3.3 Enforce server-side tenant authorization and reject body/query/header tenant substitution.
- [ ] 3.4 Validate issuer fiscal identity using the authoritative Manus tenant profile and normalize document type, number, verification digit, and legal name according to the proven contract.
- [ ] 3.5 Persist sanitized readiness, mismatch, and last-check metadata only where the verified schema supports it; otherwise keep it ephemeral and audited.
- [ ] 3.6 Add audit events for writes, credential replacement, checks, mismatches, and blocked readiness.
- [ ] 3.7 Add API unit and integration tests for SUPER_ADMIN authorization, cross-tenant rejection, safe response shape, default uniqueness, and disabled/mismatch safety.

## 4. Billing backend and FactuCore adapter

- [ ] 4.1 Add the internal administration transport contract between Manus API and `backend-facturacion-electronica`, authenticated with the existing internal service pattern.
- [ ] 4.2 Implement only the verified read-only FactuCore connection/identity operation in the billing backend.
- [ ] 4.3 Pass `factuCoreTenantId` from tenant-scoped settings only after validating it against the authenticated provider identity; never let browser input select a provider tenant unchecked.
- [x] 4.4 Harden `FactuCoreClient` diagnostics so bodies, responses, credentials, and provider payloads are redacted while preserving safe status evidence.
- [ ] 4.5 Add fake-provider and local-stub contract tests; add authorized non-production integration evidence only if available.
- [ ] 4.6 Verify that connection checks cannot create, issue, retry, or mutate electronic documents.

## 5. Frontend wizard

- [ ] 5.1 Add an Electronic Billing section to `web/app/[tenant]/configuracion/page.tsx` using the existing tenant configuration flow and permission model.
- [ ] 5.2 Add provider/environment/status controls with clear disabled, incomplete, mismatch, and ready states.
- [ ] 5.3 Add write-once credential fields with replace confirmation, no prefilled secret values, and no secret display after save.
- [ ] 5.4 Add read-only FactuCore tenant identity and fiscal identity results; never render `clientSecret` or raw provider responses.
- [ ] 5.5 Add UI tests or focused validation coverage for tenant switching, SUPER_ADMIN scope, safe masking, and mismatch blocking.

## 6. Integration and QA gate

- [ ] 6.1 Verify API outbox and billing backend inbox contracts remain unchanged for existing POS sales.
- [ ] 6.2 Run multi-tenant QA with principal tenant and KSOLECTRI fixtures, including cross-tenant access attempts and mismatched FactuCore identity.
- [ ] 6.3 Run API tests, billing backend tests, frontend lint, frontend build, backend builds, and relevant integration tests.
- [ ] 6.4 Run `openspec validate --strict --change administrar-facturacion-electronica-por-tenant` and attach evidence for every completed task.
- [ ] 6.5 Confirm no invoice was issued, no historical document changed, no production database was modified, and no secret appeared in logs or artifacts.
- [ ] 6.6 Obtain explicit production rollout approval only after all stop conditions are cleared.
