## ADDED Requirements

### Requirement: Fail-closed fiscal eligibility
Electronic billing SHALL require canonical country, department, municipality, person type, tax regime, and valid responsibilities according to the current billing contract before creating a provider-bound snapshot.

#### Scenario: Complete profile
- **WHEN** all required canonical fields are present and valid
- **THEN** eligibility passes and the immutable snapshot retains those values

#### Scenario: Missing profile
- **WHEN** any required field is absent or inconsistent
- **THEN** eligibility fails before outbox/provider document creation with the exact missing field

### Requirement: Diagnostic safety
Temporary application contexts used for audit or backfill SHALL disable `INTEGRATION_OUTBOX_DISPATCHER_ENABLED` and `ELECTRONIC_BILLING_BACKGROUND_ENABLED`.

#### Scenario: Audit context
- **WHEN** a diagnostic or migration audit starts
- **THEN** no dispatcher or background billing worker starts
