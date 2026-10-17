# Electronic billing administration audit

## ADDED Requirements

### Requirement: Administrative read failures are sanitized
Administrative read endpoints SHALL preserve operational diagnostics internally without returning provider, database, credential, or internal exception details to the browser.

#### Scenario: Billing backend read fails
- **WHEN** the internal billing read is unavailable or rejects a request
- **THEN** Manus returns a standardized safe error
- **AND** the response does not include the internal token, SQL, ciphertext, credential reference, or exception stack

### Requirement: Administrative actions are auditable
The system SHALL audit configuration writes, enable/disable actions, credential replacement, connection checks, identity matches, identity mismatches, and blocked billing readiness.

#### Scenario: Activation is audited without secrets

- **WHEN** a configuration is enabled and defaulted through the explicit activation operation
- **THEN** the existing configuration audit row records the tenant, configuration, provider, environment, transition, and legacy-reference clearing outcome
- **AND** it contains no ciphertext, credential, token, or provider payload

#### Scenario: Configuration is changed
- **WHEN** a SUPER_ADMIN changes a tenant billing configuration
- **THEN** the audit record includes actor, target tenant, action, outcome, correlation ID, provider, and environment
- **AND** it excludes raw secrets and authorization material

### Requirement: Failed checks leave evidence
The system SHALL record a sanitized failure classification for denied, unavailable, invalid, and mismatched identity checks.

#### Scenario: FactuCore check is unavailable
- **WHEN** the provider contract cannot be reached or is not proven
- **THEN** the audit records a safe unavailable outcome
- **AND** the tenant remains not-ready for billing
