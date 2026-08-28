## ADDED Requirements

### Requirement: Document creation is idempotent per tenant and provider
The system SHALL prevent duplicate documents using the combination of tenant, provider, document type, and external reference.

#### Scenario: Same document is retried safely
- **WHEN** a client retries the same create request with the same canonical payload
- **THEN** the system returns the original document outcome instead of creating a duplicate row

#### Scenario: Same key but different payload
- **WHEN** a request reuses the same unique key with different business data
- **THEN** the system rejects the conflict

#### Scenario: Different provider, same business key
- **WHEN** two different providers are configured for the same tenant
- **THEN** the same external reference can be managed independently per provider

