## ADDED Requirements

### Requirement: Electronic billing data is tenant isolated
The system SHALL scope providers, configurations, documents, lines, taxes, references, events, attachments, and deliveries by tenant.

#### Scenario: Cross-tenant access is attempted
- **WHEN** a tenant tries to read another tenant's electronic document
- **THEN** the system rejects the access

#### Scenario: Child records are queried
- **WHEN** the system reads lines, taxes, references, events, attachments, or deliveries
- **THEN** the records remain bound to the parent document tenant

### Requirement: Disabled billing does not block core POS
The system SHALL allow a tenant without electronic billing configuration to keep operating sales and returns normally.

#### Scenario: Tenant has no provider config
- **WHEN** the tenant does not configure a billing provider
- **THEN** the POS flow continues without creating electronic documents

