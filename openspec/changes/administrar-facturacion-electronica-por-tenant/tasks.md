## 1. Evidence and governance gate

- [x] 1.1 Confirm branch, base HEAD, clean status, and no unrelated worktree changes before implementation.
- [x] 1.2 Inventory existing OpenSpec billing changes and map every new requirement to this change without duplicating runtime ownership.
- [x] 1.3 Produce a read-only schema drift report for `V072`, `V088`, migration history, and the target non-production database; stop if access or drift evidence is missing.
- [x] 1.4 Obtain and record the real FactuCore administrative identity/status contract, endpoint, authentication scope, and response fields; stop if not proven.
- [x] 1.5 Investigate the KSOLECTRI incident through authorized, sanitized comparisons of Manus tenant fiscal identity, `credential_reference`, API-client identity, and FactuCore tenant identity; do not print secrets or issue documents.
- [x] 1.6 Reconcile QA `V089__tenant_electronic_billing_encrypted_credentials.sql` provenance and checksum against Git history; record current-branch artifact and snapshot drift without creating a duplicate migration.
- [x] 1.7 Record the owner-accepted KSOLECTRI shared-credential QA fixture and its production boundary.
- [x] 1.8 Select `encrypted_credentials` AES-256-GCM v2 plus external key ownership for new writes, retaining `credential_reference` fallback; leave operational provisioning as a Phase 2 gate.

## 2. Database and secret boundary

- [x] 2.1 Reuse current provider/config tables and document why no migration is needed; V089 is already applied in QA and no duplicate migration is authorized.
- [ ] 2.2 Add repository queries that always scope configuration reads and writes by target `tenant_id` and preserve the enabled-default uniqueness invariant.
- [x] 2.3 Define safe configuration/status DTOs that exclude raw credentials, `clientSecret`, auth headers, and raw provider payloads.
- [ ] 2.4 Define write-once credential replacement semantics compatible with `credential_reference` and environment resolution.
- [x] 2.4a Define the tenant create/update request contract, write-only credential fields, disabled-by-default behavior, and operational keyring fail-closed gate; live persistence remains disabled until key ownership/recovery is proven.
- [x] 2.4b Add transactional tenant configuration persistence and Billing-owned audit rows with ciphertext preservation on metadata-only updates; do not apply the migration in QA.
- [x] 2.6 Restore or otherwise reconcile the V089 migration artifact and checked-in schema snapshot through an approved repository change; do not fabricate a replacement migration.
- [ ] 2.7 Verify billing-backend key injection, rotation/versioning, recovery ownership, and fail-closed behavior before enabling credential writes.
- [x] 2.7a Add keyring cryptographic self-test and explicit disabled-by-default write gate; operational ownership, recovery and activation remain pending.
- [x] 2.7b Add a read-only V106 schema/checksum/index probe to the protected runtime readiness DTO; keep ownership and recovery `UNKNOWN` without approved external evidence.
- [x] 2.7c Make credential INSERT/REPLACEMENT consume the same fail-closed readiness decision; keep the default operational approval provider `UNKNOWN` and preserve metadata-only updates.
- [x] 2.7d-a Add the additive QA-only V107 approval ledger and fail-closed database reader; do not expose approval writes or mark unverified evidence as approved.
- [ ] 2.7d Add an authenticated, durable QA operational-attestation provider with separate operator/approver evidence, key/environment binding, independent recovery verification, expiry and revocation; do not activate writes until it is implemented and approved.
- [ ] 2.7d-b Verify three distinct authenticated Manus identities and implement the approved recovery-evidence verification source before exposing attestation or revocation writes.
- [x] 2.7e Add a strictly QA-scoped readiness policy using existing schema/keyring/self-test/write-gate checks; preserve V107 approval requirements outside QA and leave V107 unapplied.
- [x] 2.7f Correct Billing PATCH validation to use generic UUID shape for tenant/config IDs while preserving strict provider ID validation; add a synthetic regression for the observed QA identifiers and V2 replacement path.
- [x] 2.7g Remove only the repeated manual credential-write flag requirement from exact `NODE_ENV=qa` readiness; keep production/non-QA flag and approval gates unchanged, and document the backend-authoritative frontend behavior.
- [x] 2.8 Add a billing-owned tenant read projection that returns credential presence booleans without selecting or decrypting secret columns.
- [x] 2.5 Add secret-redaction utilities and tests for request logs, response logs, exceptions, audit metadata, outbox payloads, and error messages.

## 3. Manus API administration

- [ ] 3.1 Add a tenant electronic-billing administration module and register it without changing POS issuance behavior.
- [ ] 3.2 Implement SUPER_ADMIN-only routes for safe configuration read/write, connection check, and read-only fiscal identity lookup after route conventions are verified.
- [x] 3.2a Add validated SUPER_ADMIN proxy routes for tenant configuration create/update with `WRITE` permission enforcement and sanitized 503 while key management is unresolved.
- [ ] 3.3 Enforce server-side tenant authorization and reject body/query/header tenant substitution.
- [x] 3.4 Validate issuer fiscal identity using the authoritative Manus tenant profile and normalize document type, number, verification digit, and legal name according to the proven contract.
- [ ] 3.5 Persist sanitized readiness, mismatch, and last-check metadata only where the verified schema supports it; otherwise keep it ephemeral and audited.
- [ ] 3.6 Add audit events for writes, credential replacement, checks, mismatches, and blocked readiness.
- [ ] 3.7 Add API unit and integration tests for SUPER_ADMIN authorization, cross-tenant rejection, safe response shape, default uniqueness, and disabled/mismatch safety.
- [x] 3.8 Add read-only `SUPER_ADMIN` provider catalog and tenant configuration routes with target-tenant existence checks and sanitized backend errors.

## 4. Billing backend and FactuCore adapter

- [x] 4.1 Add the internal administration transport contract between Manus API and `backend-facturacion-electronica`, authenticated with the existing internal service pattern.
- [x] 4.2 Implement only the verified read-only FactuCore connection/identity operation in the billing backend.
- [x] 4.3 Pass `factuCoreTenantId` from tenant-scoped settings only after validating it against the authenticated provider identity; never let browser input select a provider tenant unchecked.
- [x] 4.4 Harden `FactuCoreClient` diagnostics so bodies, responses, credentials, and provider payloads are redacted while preserving safe status evidence.
- [x] 4.4a Add correlation IDs and sanitized runtime diagnostics for credential readiness, FactuCore HTTP status classification, and identity comparison; do not execute live authenticated QA calls without explicit approval.
- [x] 4.4b Add the protected Billing Backend crypto runtime readiness endpoint with allowlisted status DTO, `no-store`, token enforcement, and historical decryption reported as `UNKNOWN` unless separately proven.
- [ ] 4.5 Add fake-provider and local-stub contract tests; add authorized non-production integration evidence only if available.
- [ ] 4.6 Verify that connection checks cannot create, issue, retry, or mutate electronic documents.
- [x] 4.7 Add authenticated internal read contracts for provider catalog and tenant configuration using the existing `API_INTERNAL_TOKEN` bearer mechanism.

## 5. Frontend wizard

- [x] 5.1 Add a read-only Electronic Billing section to `web/app/[tenant]/configuracion/page.tsx` using the existing tenant wizard and `SUPER_ADMIN` role model.
- [x] 5.2 Render provider catalog, environment, enabled/default state, credential presence, and clear incomplete/inconsistent/empty/error states without adding mutation controls.
- [x] 5.3 Add write-once credential fields with replace confirmation, no prefilled secret values, and no secret display after save.
- [x] 5.4 Render the safe configured FactuCore tenant identifier only; identity and fiscal readiness remain unverified and unavailable.
- [x] 5.5 Add focused safe read-model coverage and tenant-switch abort behavior; credential writes and mismatch blocking remain future gates.
- [x] 5.5a Add a tenant-scoped local editor draft with blank write-only credential fields, local validation, identity validation action, and a disabled Save control until an authoritative backend write-readiness contract exists.
- [x] 5.6 Add an authenticated backend write-readiness contract before enabling the frontend Save action; it must include schema migration readiness, keyring self-test, operational ownership/recovery approval, and the existing fail-closed write gate.
- [x] 5.7 Add the initial-configuration empty state and reuse the existing tenant editor with the authenticated POST create contract; require both write-only credentials, refresh the safe read model after creation, and preserve existing PATCH edit behavior.
- [x] 5.8 Add a separate admin-only FactuCore context resolver for disabled/non-default configurations; reuse V2 AAD resolution and keep standard invoice resolution fail-closed on disabled configurations.

## 6. Integration and QA gate

- [ ] 6.1 Verify API outbox and billing backend inbox contracts remain unchanged for existing POS sales.
- [ ] 6.2 Run multi-tenant QA with principal tenant and KSOLECTRI fixtures, including cross-tenant access attempts and mismatched FactuCore identity.
- [ ] 6.3 Run API tests, billing backend tests, frontend lint, frontend build, backend builds, and relevant integration tests.
- [ ] 6.4 Run `openspec validate --strict --change administrar-facturacion-electronica-por-tenant` and attach evidence for every completed task.
- [ ] 6.5 Confirm no invoice was issued, no historical document changed, no production database was modified, and no secret appeared in logs or artifacts.
- [ ] 6.6 Obtain explicit production rollout approval only after all stop conditions are cleared.

## Activation follow-up

- [x] A1 Add tenant-scoped atomic activation/default selection with explicit legacy-reference clearing, V2 byte preservation, concurrency guard, and V106-compatible audit metadata.
- [x] A2 Add authenticated Manus API and existing frontend API transport for explicit activation confirmation.
- [x] A3 Add visible activation state and confirmation control without changing initial-create defaults or standard issuance gates.
- [x] A4 Add focused activation service/controller/frontend regression tests and collect runtime QA evidence. The activation controller regression passes; the pre-existing diagnostic fixture still expects `status` while the corrected classifier reads `httpStatus`.
- [x] A5 Replace native activation confirmation with the existing Manus `ConfirmDialog`, preserving one-submit behavior, cancellation, safe consequences, and post-success refresh.
- [x] A6 Confirm the existing operational sale UI reuses the authenticated sale billing route and guarded pre-invoice flow for eligible failed/no-document sales; add regression coverage without adding a second recovery mechanism.
