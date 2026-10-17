## ADDED Requirements

### Requirement: Recover a rejected provider-create intent after confirmed absence

The system MUST allow the existing provider-create recovery operation for a tenant-scoped electronic document only when the document is `REJECTED`, has `last_error_code` `FACTUCORE_VALIDATION`, has processing stage `PROVIDER_CREATE_INTENT`, has an external reference, and has no provider document ID.

#### Scenario: Provider lookup confirms absence

- **WHEN** the authorized recovery operation is called and the provider lookup returns not found
- **THEN** the system MUST atomically move the same document to `PENDING` and `PRE_PROVIDER_CREATE`, append the existing recovery audit event, and leave the original Outbox event unchanged
- **AND** the system MUST NOT create a second MANUS document or modify the sale or payment

#### Scenario: Provider lookup finds a document

- **WHEN** the provider returns a document for the external reference
- **THEN** the system MUST reconcile that provider document and MUST NOT issue a new provider create request

#### Scenario: Provider state is unknown

- **WHEN** provider lookup times out, fails, returns malformed data, or has an unclassified result
- **THEN** the system MUST fail closed and MUST NOT reset or reissue the MANUS document

#### Scenario: Concurrent recovery

- **WHEN** two recovery requests target the same tenant and document concurrently
- **THEN** the existing document lock and conditional transition MUST allow at most one recovery transition

#### Scenario: Other rejected documents

- **WHEN** a rejected document has another error code, a provider document ID, another processing stage, or no external reference
- **THEN** the system MUST reject recovery without provider creation
