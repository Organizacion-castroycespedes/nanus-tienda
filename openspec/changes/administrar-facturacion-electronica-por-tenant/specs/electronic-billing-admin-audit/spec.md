# Electronic billing administration audit

## ADDED Requirements

### Requirement: Administrative actions are auditable
The system SHALL audit configuration writes, enable/disable actions, credential replacement, connection checks, identity matches, identity mismatches, and blocked billing readiness.

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
