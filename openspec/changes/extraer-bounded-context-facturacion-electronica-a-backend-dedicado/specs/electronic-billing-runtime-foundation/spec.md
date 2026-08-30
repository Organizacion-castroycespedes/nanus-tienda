# Electronic Billing Runtime Foundation

## ADDED Requirements

### Requirement: Billing backend runtime foundation

The backend billing service SHALL have its own runtime foundation for:

- configuration
- PostgreSQL pool
- database service
- repository wiring
- module structure

It SHALL reuse PostgreSQL and SQL direct access.

It SHALL NOT introduce ORM-only persistence as the default strategy for this extraction.

The runtime foundation SHALL support credential references for provider secrets without storing plaintext secret values in the database.

#### Scenario: Backend can connect to shared PostgreSQL
- **WHEN** the backend starts
- **THEN** it SHALL resolve its database configuration from environment
- **AND** it SHALL be able to create its own database pool

#### Scenario: Credential reference resolves at runtime
- **WHEN** a provider operation needs credentials
- **THEN** the backend SHALL resolve the `credential_reference` at runtime
- **AND** it SHALL keep the secret material out of the database
