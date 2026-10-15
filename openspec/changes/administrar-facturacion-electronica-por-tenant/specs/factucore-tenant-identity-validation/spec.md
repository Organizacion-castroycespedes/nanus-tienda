# FactuCore tenant identity validation

## ADDED Requirements

### Requirement: Proven provider contract only
The billing backend SHALL use only a documented and tested FactuCore HTTP contract for connection and tenant identity validation.

#### Scenario: Identity endpoint is not proven
- **WHEN** repository code or authorized FactuCore documentation does not prove an identity/status endpoint and response schema
- **THEN** the validation operation is blocked as unavailable
- **AND** it does not issue a test invoice or query a FactuCore database

### Requirement: Identity mismatch blocks billing
The adapter SHALL compare the verified FactuCore tenant identity with the expected Manus tenant fiscal identity before reporting a configuration as ready.

#### Scenario: KSOLECTRI credentials point to the principal tenant
- **WHEN** the authenticated API client resolves to a FactuCore tenant different from KSOLECTRI's configured tenant identity
- **THEN** validation returns a sanitized mismatch result
- **AND** billing readiness is false
- **AND** secrets and raw provider responses are not persisted or logged

### Requirement: No document side effects
Connection and identity checks SHALL be read-only with respect to fiscal documents.

#### Scenario: Administrator checks connection
- **WHEN** an administrator requests a connection check
- **THEN** the system performs only the verified read-only provider operation
- **AND** it does not create, issue, retry, or mutate an electronic document

### Requirement: QA shared-credential exception is bounded
Shared credentials MAY exist as an owner-accepted, controlled QA fixture, but SHALL NOT establish tenant ownership or production readiness.

#### Scenario: QA fixture reuses a credential
- **WHEN** sanitized QA evidence shows KSOLECTRI and another tenant share a credential reference or encrypted blob
- **THEN** the result is recorded as an accepted QA fixture
- **AND** no incident cause is inferred from reuse alone
- **AND** production activation still requires authenticated FactuCore API-client tenant identity and issuer matching
