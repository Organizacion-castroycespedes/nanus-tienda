## ADDED Requirements

### Requirement: Failed and manual history remains non-certified

The disposition SHALL preserve `success=false`, manual and bundle provenance as
historical review evidence. It SHALL distinguish `EXECUTED_LEGACY` from
`HISTORY_CERTIFIED` and SHALL not create synthetic certification.

#### Scenario: Failed historical row

- **WHEN** a historical row has `success=false`
- **THEN** it SHALL be classified `HISTORICAL_REVIEW_REQUIRED`

#### Scenario: Manual or bundle provenance

- **WHEN** a historical record uses manual or bundle provenance
- **THEN** it SHALL not be treated as governed-runner execution evidence

#### Scenario: No automatic repair

- **WHEN** disposition is requested
- **THEN** the system SHALL return metadata only and perform no database or SQL mutation
