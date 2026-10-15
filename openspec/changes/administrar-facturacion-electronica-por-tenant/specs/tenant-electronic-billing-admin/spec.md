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
