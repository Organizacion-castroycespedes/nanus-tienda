## Purpose

This capability defines safe, host-independent validation for Windows installer artifacts while preserving the existing observational service status contract and installer lifecycle behavior.

## ADDED Requirements

### Requirement: Host-independent artifact validation

The Windows installer artifact validator MUST validate the artifact's stable metadata, expected paths, field types, and state invariants without requiring the validation host to have no `ManusPeripheralAgent` service.

#### Scenario: Service absent

- **WHEN** status reports boolean `installed`, `servicePresent=false`, and `serviceRunning=false`
- **THEN** validation passes when inspect metadata and expected paths are valid

#### Scenario: Installed service stopped

- **WHEN** status reports `servicePresent=true` and `serviceRunning=false`
- **THEN** validation passes when the status fields and artifact metadata are valid

#### Scenario: Installed service running

- **WHEN** status reports `servicePresent=true` and `serviceRunning=true`
- **THEN** validation passes when the status fields and artifact metadata are valid, and the existing service state is reported informationally

#### Scenario: Running without service presence

- **WHEN** status reports `serviceRunning=true` and `servicePresent=false`
- **THEN** validation fails as an incoherent status response

### Requirement: Backward-compatible expected service binary

The `serviceBinary` field MUST retain its existing meaning as the expected executable path derived from the embedded installer manifest. Validation MUST NOT fabricate or require an observed Windows SCM binary path.

#### Scenario: Expected binary path

- **WHEN** inspect and status return a `serviceBinary` path under the versioned Peripheral Agent installation root
- **THEN** validation accepts it as the expected path and preserves the field name and semantics

### Requirement: Corrupt metadata rejection

The validator MUST reject malformed status data, mismatched installer version metadata, invalid service identity metadata, and paths outside the expected installation layout.

#### Scenario: Malformed status

- **WHEN** a status response contains a non-boolean installed or service state field
- **THEN** validation fails with a deterministic validation error

#### Scenario: Corrupt inspect metadata

- **WHEN** inspect metadata has a wrong version, service name, service account, or expected installation path
- **THEN** validation fails before reporting success
