## ADDED Requirements

### Requirement: Tenant provider configuration is explicit
The system SHALL store tenant-level provider configuration with provider code, environment, enabled flag, default flag, and a secret reference instead of plain-text secrets.

#### Scenario: Tenant enables a provider
- **WHEN** a tenant activates a provider configuration
- **THEN** the configuration records the provider code and environment
- **AND** no raw secret is stored in the domain row

#### Scenario: Tenant has no provider
- **WHEN** a tenant has no billing provider configuration
- **THEN** the POS and sales flows continue normally
- **AND** electronic billing remains disabled for that tenant

#### Scenario: Duplicate active default is prevented
- **WHEN** a tenant tries to mark two provider configs as the active default
- **THEN** the system rejects the second conflicting configuration

### Requirement: Provider code is stable
The system SHALL require a stable provider code such as `FACTUCORE` and SHALL prevent duplicate codes.

#### Scenario: Same provider code is reused
- **WHEN** another config tries to reuse an existing provider code
- **THEN** the system rejects the duplicate code

