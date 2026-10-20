## ADDED Requirements

### Requirement: Historical drift is classified without mutation

The reconciler SHALL classify repository-only, history-only, checksum drift,
unverifiable checksum and duplicate numeric identities with source provenance.
Classification SHALL not execute or mutate historical SQL or database history.

#### Scenario: Duplicate historical identity

- **WHEN** two historical artifacts or records share a numeric V### identity
- **THEN** the result SHALL report `DUPLICATE_NUMERIC_VERSION` and remain
  `PREEXISTING_HISTORICAL_BASELINE`

#### Scenario: Missing history row

- **WHEN** a pre-governance artifact has no matching history row
- **THEN** the result SHALL not infer nonexecution

#### Scenario: Post-cutover isolation

- **WHEN** an artifact is greater than V095
- **THEN** historical classification SHALL not authorize replay or bypass
