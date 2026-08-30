# Electronic Billing Credential Resolution

## ADDED Requirements

### Requirement: Credential reference only in database

The billing backend SHALL store only a neutral `credential_reference` in provider configuration rows.

The billing backend SHALL NOT store plaintext provider secrets in:

- `tenant_electronic_billing_configs`
- electronic document tables
- inbox tables
- outbox tables
- logs
- metadata payloads

#### Scenario: Database stores only reference
- **WHEN** a tenant billing config is persisted
- **THEN** the row SHALL keep only a neutral `credential_reference`
- **AND** it SHALL NOT persist plaintext secret values

### Requirement: Runtime secret resolution

The billing backend SHALL resolve provider secret material at operation time.

The initial implementation SHALL use environment-based secret resolution.

The resolver SHALL be owned by `backend-facturacion-electronica`.

#### Scenario: Env resolver returns runtime-only secret material
- **WHEN** the billing backend resolves a provider credential reference
- **THEN** it SHALL read the runtime secret from the selected environment variable
- **AND** it SHALL return the material only for the current operation

### Requirement: FactuCore adapter validates provider secret shape

The FactuCore adapter SHALL validate the resolved secret payload before sending any HTTP request.

The FactuCore client SHALL NOT read `process.env` directly.

The resolved secret material SHALL remain operation-scoped and SHALL NOT be cached in shared mutable singleton state.

#### Scenario: Missing credential reference blocks provider execution
- **WHEN** provider configuration is enabled but the `credential_reference` is missing
- **THEN** the provider operation SHALL fail with a controlled configuration error
- **AND** it SHALL NOT send FactuCore HTTP traffic

#### Scenario: Unknown credential reference blocks provider execution
- **WHEN** the `credential_reference` points to an absent environment secret
- **THEN** the resolver SHALL fail with a controlled not-found error
- **AND** it SHALL NOT leak secret values in logs or error payloads

#### Scenario: Tenant isolation is preserved
- **WHEN** two tenants resolve credentials concurrently
- **THEN** each tenant SHALL receive only its own resolved secret material
- **AND** no credential data SHALL leak across operations
