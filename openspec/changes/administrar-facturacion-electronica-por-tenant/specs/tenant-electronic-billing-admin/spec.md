# Tenant electronic billing administration

## ADDED Requirements

### Requirement: SUPER_ADMIN-only administration
The API SHALL require an authenticated `SUPER_ADMIN` for every tenant electronic-billing administration operation.

#### Scenario: Non-super-admin attempts administration
- **WHEN** a user without `SUPER_ADMIN` requests configuration, credential, connection-check, or fiscal-identity administration
- **THEN** the API rejects the request
- **AND** it does not reveal whether the target tenant has a configuration

### Requirement: Tenant-scoped configuration
The API SHALL read and write configuration for exactly the authorized target tenant and SHALL enforce the existing one-enabled-default invariant.

#### Scenario: Cross-tenant target is supplied
- **WHEN** the request body, query, or header names a tenant outside the actor's authorized administrative scope
- **THEN** the API rejects the request
- **AND** no provider configuration is read or changed

#### Scenario: Configuration is returned safely
- **WHEN** an authorized administrator reads a configuration
- **THEN** the response contains status metadata and a masked credential state
- **AND** it never contains raw credential values or `clientSecret`

### Requirement: Billing safety gate
The system SHALL prevent new electronic billing for a disabled, incomplete, or identity-mismatched tenant configuration.

#### Scenario: Identity mismatch
- **WHEN** the FactuCore identity does not match the expected Manus fiscal issuer or configured FactuCore tenant
- **THEN** the configuration is marked unusable for billing
- **AND** the POS core flow remains available
- **AND** no document is issued

#### Scenario: Disabled configuration identity validation
- **WHEN** an authorized administrator validates a tenant's existing FactuCore identity
- **AND** the selected configuration is disabled or non-default
- **THEN** the read-only identity path may select that exact tenant-scoped configuration
- **AND** it resolves credentials with the exact tenant/provider/configuration AAD
- **AND** it does not enable, default, mutate, or otherwise make the configuration eligible for invoice issuance
- **AND** the standard billing resolver continues to reject the disabled configuration

### Requirement: Explicit tenant configuration activation

The system SHALL provide a tenant-scoped, SUPER_ADMIN-only activation operation that atomically enables one validated V2 configuration, makes it the tenant default, clears the legacy credential reference when explicitly confirmed, and preserves the encrypted credential bytes.

#### Scenario: Validated configuration is activated

- **WHEN** an authorized SUPER_ADMIN explicitly confirms activation for a selected configuration
- **AND** the configuration belongs to the requested tenant, has valid V2 credentials, and the read-only FactuCore identity is `MATCH`
- **THEN** the operation enables that configuration and makes it the only enabled default for the tenant
- **AND** it clears `credential_reference` in the same transaction
- **AND** it preserves `encrypted_credentials` byte-for-byte
- **AND** it writes a sanitized V106-compatible audit event

#### Scenario: Activation conflicts or fails

- **WHEN** the configuration is missing, cross-tenant, incomplete, identity-mismatched, or another activation commits concurrently
- **THEN** the operation fails without a partial state
- **AND** existing configurations and encrypted credentials remain unchanged

#### Scenario: Existing issuance remains fail-closed

- **WHEN** activation has not committed
- **THEN** the standard issuance resolver continues to require `enabled=true` and `is_default=true`
- **AND** administrative identity validation cannot enable or default a configuration implicitly

#### Scenario: Activation confirmation uses the corporate dialog

- **WHEN** an authorized administrator selects activation for a validated tenant configuration
- **THEN** the existing Manus confirmation dialog shows the tenant, provider, environment, automatic-issuance consequence, and legacy-reference cleanup
- **AND** Cancel closes the dialog without a request
- **AND** Confirm sends at most one authenticated activation request and refreshes the safe configuration projection after success
- **AND** the browser never uses a native confirmation or exposes credentials

### Requirement: Safe operational electronic billing request

The existing operational sale UI SHALL expose the existing authenticated `POST /api/sales/:id/electronic-billing` action only when the backend-provided tenant-scoped sale eligibility and POS `WRITE` authorization allow it.

#### Scenario: Eligible paid sale requests billing

- **WHEN** an authorized operator opens a `CONFIRMED` and paid sale with no electronic document and the backend reports it eligible
- **THEN** the UI opens the existing pre-invoice confirmation flow
- **AND** final confirmation sends exactly one request to the existing sale billing route
- **AND** the UI distinguishes request acceptance from provider creation, transmission, and DIAN acceptance
- **AND** the UI refreshes the sale state without issuing a second request automatically

#### Scenario: Unsafe recovery is hidden

- **WHEN** tenant ownership, POS `WRITE` authorization, sale eligibility, or document/outbox recovery state is not proven
- **THEN** the UI hides the request/recovery action
- **AND** it never bypasses backend guards, resets outbox attempts, or creates a second billing mechanism

### Requirement: Safe administrative read layer
The API SHALL expose provider catalog and tenant configuration reads only to an authenticated `SUPER_ADMIN`, through the authenticated internal billing-backend contract.

#### Scenario: SUPER_ADMIN reads provider catalog
- **WHEN** a valid `SUPER_ADMIN` requests the provider catalog
- **THEN** Manus calls the billing backend with the existing internal bearer token
- **AND** the response contains only provider identity, active state, and capabilities
- **AND** it contains no credentials, ciphertext, credential references, key identifiers, or raw provider payloads

#### Scenario: SUPER_ADMIN reads a target tenant configuration
- **WHEN** a valid `SUPER_ADMIN` requests `/admin/electronic-billing/tenants/:tenantId/config`
- **THEN** Manus verifies that the target tenant exists before calling the billing backend
- **AND** the response contains only safe configuration metadata and credential presence booleans
- **AND** incomplete or provider-inconsistent rows return a sanitized `configurationStatus`
- **AND** each database read is scoped to the requested tenant

#### Scenario: Non-admin or invalid target requests configuration
- **WHEN** a non-`SUPER_ADMIN` requests the route, or the target tenant is malformed, missing, or unavailable
- **THEN** the request is rejected with a sanitized error
- **AND** the billing backend is not called for a missing tenant

### Requirement: SUPER_ADMIN wizard configuration flow
The existing tenant edit wizard SHALL show electronic-billing configuration only to `SUPER_ADMIN` users and SHALL use the Manus API safe read and write routes.

#### Scenario: SUPER_ADMIN opens a tenant configuration
- **WHEN** a `SUPER_ADMIN` opens the electronic-billing wizard step for a selected tenant
- **THEN** the browser requests only `GET /api/admin/electronic-billing/providers` and `GET /api/admin/electronic-billing/tenants/:tenantId/config`
- **AND** it renders provider, environment, enabled/default, base URL presence, credential presence, configuration status, and safe `settings.factuCoreTenantId`
- **AND** it does not call the billing backend directly or issue a write request

#### Scenario: SUPER_ADMIN starts initial configuration
- **WHEN** the selected tenant has no electronic-billing configuration
- **THEN** the wizard shows a corporate empty state with `Configurar facturación electrónica`
- **AND** activating the action opens the existing provider editor in create mode
- **AND** the editor requires an active provider, environment, FactuCore tenant mapping, and both write-only credentials before submitting
- **AND** it uses `POST /api/admin/electronic-billing/tenants/:tenantId/config`

#### Scenario: Initial configuration is saved
- **WHEN** the create form passes local validation and the backend reports `writeReady: true`
- **THEN** the browser sends one tenant-scoped create request through the existing authenticated API client
- **AND** the tenant configuration is refreshed after success
- **AND** the normal identity-validation action becomes available
- **AND** no credential value is rendered after the save

#### Scenario: Existing edit mode remains unchanged
- **WHEN** the selected tenant already has a configuration
- **THEN** the editor uses the existing `PATCH` route
- **AND** blank credential fields preserve the stored encrypted credential
- **AND** the create action is not shown

#### Scenario: Tenant selection changes while a read is pending
- **WHEN** the selected tenant changes before the prior read completes
- **THEN** the prior request is aborted or ignored
- **AND** data from the prior tenant is not rendered for the new tenant

#### Scenario: Read-only view receives unsafe or unavailable data
- **WHEN** the read is denied, fails, has no configuration, or reports `INCONSISTENT`
- **THEN** the UI shows a sanitized denied, error, empty, or review-required state
- **AND** it never renders credentials, credential references, ciphertext, key identifiers, authorization headers, raw provider payloads, or internal exceptions
### Requirement: Credential writes are write-only and fail closed

The system MUST accept tenant credential writes only through dedicated administrative requests,
MUST encrypt them with AES-256-GCM v2 using tenant/provider/configuration AAD, MUST force newly
created configurations disabled and non-default, and MUST return no credential material in any
response or log. If external key ownership, active-key injection, historical-key recovery, or
rotation readiness is not proven, the authenticated routes MUST return a sanitized 503 and MUST
perform no database mutation.

#### Scenario: Missing operational keyring

- **WHEN** a SUPER_ADMIN submits a valid tenant configuration with `clientKey` and `clientSecret`
- **AND** the Billing Backend cannot prove an operational encryption keyring
- **THEN** the request returns 503
- **AND** no tenant configuration or document row is inserted or updated
- **AND** the response contains no secret, ciphertext, key identifier, or internal exception.

### Requirement: Configuration and audit changes are atomic

When operational credential writes are explicitly approved, the Billing Backend MUST persist the
tenant configuration and its sanitized configuration audit event in the same PostgreSQL transaction.
Metadata-only updates MUST preserve the existing encrypted credential value. Credential replacement
MUST use the exact tenant/provider/configuration AAD binding. New configurations MUST remain disabled
and non-default.

#### Scenario: Audit persistence fails

- **WHEN** configuration persistence succeeds but the audit insert fails
- **THEN** the transaction rolls back the configuration change
- **AND** no partial configuration is available to billing.

### Requirement: Tenant wizard editor remains fail-closed
The tenant wizard SHALL provide tenant-scoped local editing fields for safe metadata, FactuCore tenant mapping, and write-only credentials, but SHALL keep Save disabled until a verified backend write-readiness contract is available.

#### Scenario: Editor opens with an existing configuration
- **WHEN** a `SUPER_ADMIN` opens the editor
- **THEN** provider, environment, mapping, and safe presence indicators are shown
- **AND** credential inputs are blank and never prefilled from stored values
- **AND** empty credential inputs mean preserve, not delete

#### Scenario: Backend write readiness is unavailable
- **WHEN** the API does not expose an authoritative keyring/schema/write-readiness result
- **THEN** the browser performs local validation only
- **AND** Save is disabled

#### Scenario: Backend reports safe credential-write readiness
- **WHEN** a `SUPER_ADMIN` with `WRITE` permission requests `GET /api/admin/electronic-billing/runtime/crypto-readiness`
- **THEN** Manus returns only schema migration state, keyring self-test state, operational ownership/recovery state, write-gate state, and a boolean `writeReady`
- **AND** the response contains no key identifiers, key material, ciphertext, credential references, credentials, or internal exception details
- **AND** `writeReady` is `false` unless every required readiness gate is proven

#### Scenario: Credential enrollment is authorized by the readiness contract
- **WHEN** the editor submits a complete API Client key and secret through the existing tenant configuration `POST` or `PATCH` route and `writeReady` is true
- **THEN** the Billing Backend encrypts the pair with AES-256-GCM v2 using tenant/provider/configuration AAD
- **AND** it persists configuration and sanitized audit data atomically
- **AND** the response contains no credential material

#### Scenario: Credential enrollment is not ready
- **WHEN** the runtime is not exact QA and keyring, schema, operational ownership, recovery, or the explicit credential-write gate is not proven
- **OR** the runtime is exact QA and schema, keyring, or synthetic self-test readiness is not proven
- **THEN** the Billing Backend rejects the write with sanitized HTTP 503
- **AND** it performs no configuration or audit mutation
- **AND** the browser does not issue POST or PATCH requests
- **AND** identity validation uses only the existing read-only FactuCore context route

#### Scenario: QA enrollment does not require repeated deployment flag activation
- **WHEN** `NODE_ENV=qa`, schema migration is `READY`, keyring status is `READY`, and synthetic self-test is `PASS`
- **AND** an authenticated `SUPER_ADMIN` has the existing tenant-scoped write permission
- **THEN** the backend reports `writeReady: true` without requiring `ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED=true`
- **AND** the existing V2 encryption, tenant/provider/configuration AAD, atomic persistence, and V106 audit rules remain mandatory

#### Scenario: Non-QA enrollment retains deployment protections
- **WHEN** the runtime environment is not exactly `qa`
- **THEN** `ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED=true` and the existing operational approval requirements remain mandatory
- **AND** missing any required gate keeps `writeReady` false
