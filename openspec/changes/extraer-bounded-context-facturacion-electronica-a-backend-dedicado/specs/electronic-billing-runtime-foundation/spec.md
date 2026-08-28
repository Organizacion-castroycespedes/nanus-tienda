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

#### Scenario: Backend can connect to shared PostgreSQL
- **WHEN** the backend starts
- **THEN** it SHALL resolve its database configuration from environment
- **AND** it SHALL be able to create its own database pool
