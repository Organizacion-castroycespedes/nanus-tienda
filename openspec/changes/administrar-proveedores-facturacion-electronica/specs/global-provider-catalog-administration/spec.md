## ADDED Requirements

### Requirement: Provider catalog routes are stable and bounded
The MANUS API SHALL expose `GET /api/admin/electronic-billing/providers` as the existing backward-compatible read route and SHALL define `POST /api/admin/electronic-billing/providers`, `PATCH /api/admin/electronic-billing/providers/:providerId`, and `PATCH /api/admin/electronic-billing/providers/:providerId/status` for the future global catalog. The Billing Backend SHALL expose corresponding authenticated internal routes below `internal/electronic-billing/admin/providers`. No DELETE route SHALL be exposed.

#### Scenario: Existing catalog read remains compatible
- **WHEN** an authorized caller requests `GET /api/admin/electronic-billing/providers`
- **THEN** the response preserves the existing safe provider catalog contract and contains no credentials or internal errors

#### Scenario: Unsupported deletion is not available
- **WHEN** a caller attempts to use a provider deletion route
- **THEN** the route is absent or returns a standardized unsupported-operation response without changing data

### Requirement: Provider administration requires layered authorization
The MANUS routes SHALL require `JwtAuthGuard`, `RolesGuard` with `SUPER_ADMIN`, and the established `PermissionsGuard`/menu permission convention. The Billing Backend routes SHALL require the configured `API_INTERNAL_TOKEN` through the existing service-to-service authentication mechanism. Menu visibility SHALL never replace backend authorization.

#### Scenario: Non-admin cannot administer providers
- **WHEN** an authenticated `ADMIN` or other non-`SUPER_ADMIN` user calls a provider administration route
- **THEN** the API returns the established forbidden response and performs no Billing Backend request

#### Scenario: Invalid internal token is rejected
- **WHEN** an internal provider request has a missing, invalid, or unavailable `API_INTERNAL_TOKEN`
- **THEN** the Billing Backend rejects it with a sanitized authentication error and performs no catalog operation

### Requirement: Provider DTOs contain metadata only
Create requests SHALL contain normalized `code`, bounded `name`, fixed `providerType` equal to `ELECTRONIC_BILLING`, and the known capability map. Metadata updates SHALL permit only `name` and capabilities. Status updates SHALL contain only `active`. Responses SHALL contain safe provider identity, status, capabilities, timestamps, and optionally aggregate dependency counts. Requests and responses SHALL never contain credentials, credential references, encrypted values, key identifiers, arbitrary URLs, authorization headers, or internal exception details.

#### Scenario: Secret-shaped fields are rejected or ignored safely
- **WHEN** a request includes credential, ciphertext, key, header, or arbitrary URL fields
- **THEN** validation rejects the request without persisting or logging those values

#### Scenario: Safe response is redacted
- **WHEN** a provider is returned by a catalog route
- **THEN** the response contains no forbidden sensitive fields and no raw database or exception payload

### Requirement: Provider identity and capabilities are validated
The Billing Backend SHALL trim and uppercase provider codes before uniqueness checks, enforce the existing database unique constraint, keep `id`, `code`, and `providerType` immutable after creation, require a registered adapter for the normalized code, and reject capabilities outside the existing capability key set or beyond the registered adapter capabilities.

#### Scenario: Duplicate code is a conflict
- **WHEN** creation or an attempted identity change uses a code already present after normalization
- **THEN** the operation returns a sanitized conflict response and leaves existing rows unchanged

#### Scenario: Unknown adapter is rejected
- **WHEN** creation requests a normalized code absent from `ElectronicBillingProviderRegistry`
- **THEN** the operation returns a sanitized validation or conflict response and does not create a catalog entry

### Requirement: Registration does not activate tenant billing
Creating or updating a provider catalog entry SHALL not create, modify, enable, default, or activate any `tenant_electronic_billing_configs` row. It SHALL not modify credential references, encrypted credentials, `settings.factuCoreTenantId`, FactuCore API clients, or fiscal documents.

#### Scenario: Catalog creation has no tenant side effect
- **WHEN** a valid provider is registered
- **THEN** only provider catalog metadata is affected and all tenant billing configurations remain unchanged

### Requirement: Deactivation is protected by transactional dependency checks
The Billing Backend SHALL reject deactivation while any enabled tenant configuration references the provider. The dependency check and status update SHALL run in one transaction with a provider-row lock and a fresh dependency recheck. Historical documents SHALL remain untouched.

#### Scenario: Enabled tenant dependency blocks deactivation
- **WHEN** an enabled tenant configuration references the provider
- **THEN** status change returns a sanitized conflict and the provider remains active

#### Scenario: Historical documents do not permit deletion
- **WHEN** historical documents reference a provider
- **THEN** no deletion operation is available and the historical rows remain unchanged

#### Scenario: Concurrent assignment wins safely
- **WHEN** a tenant configuration becomes enabled during a deactivation attempt
- **THEN** transaction isolation or locking causes the status change to fail closed with a conflict rather than leaving an enabled configuration on an inactive provider

### Requirement: Errors and concurrency are standardized
The proxy and Billing Backend SHALL distinguish validation failure, unauthorized/forbidden access, not found provider, duplicate/conflict dependency, unavailable internal service, and schema/database failure using existing service conventions. Responses SHALL not expose SQL, stack traces, credentials, ciphertext, or raw upstream bodies.

#### Scenario: Missing provider is not leaked
- **WHEN** a mutation targets an unknown `providerId`
- **THEN** the caller receives the established not-found response without database details

#### Scenario: Internal failure is sanitized
- **WHEN** the Billing Backend or database fails unexpectedly
- **THEN** the MANUS API returns the established unavailable/error response and logs only sanitized operation metadata

### Requirement: QA dependency evidence is sanitized and read-only
Authorized QA inspection SHALL use SELECT-only queries and MAY return only provider code, active state, enabled tenant-configuration count, and historical-document count grouped by provider. It SHALL not access or display tenant identity, fiscal data, credentials, credential references, encrypted credentials, or document contents.

#### Scenario: Safe dependency counts are collected
- **WHEN** a local authorized QA database connection is proven safe
- **THEN** the inspection returns aggregate counts only and leaves database state unchanged

#### Scenario: Unsafe or unavailable QA access is blocked
- **WHEN** a safe authorized QA connection cannot be established
- **THEN** counts are reported as `UNKNOWN` and no alternate or production connection is attempted
