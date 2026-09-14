## ADDED Requirements

### Requirement: Tenant-scoped fiscal review queue
The system SHALL expose a read-only queue for customers and suppliers whose normal fiscal profile is incomplete, using the same completeness predicates as the certified fiscal audit. The response SHALL include entity type, identifier, display name, masked document, canonical location, current fiscal values, missing fields, and review reason. Final consumers SHALL be classified as `NOT_REQUIRED` exceptions and SHALL NOT be treated as normal incomplete profiles.

#### Scenario: Queue returns unresolved profiles
- **WHEN** an authorized user requests the fiscal review queue for a tenant
- **THEN** only records from that tenant are returned with exact missing-field reasons and no secrets

#### Scenario: Final consumer exception
- **WHEN** a final consumer is evaluated
- **THEN** it is classified `NOT_REQUIRED` and is not counted as a normal fiscal review

#### Scenario: Cross-tenant request
- **WHEN** a caller supplies another tenant identifier
- **THEN** the API ignores or rejects it and never returns another tenant's records

### Requirement: Controlled fiscal profile values
Customer and supplier editors SHALL offer only supported `NATURAL`/`JURIDICA` person types, supported tax regimes, and responsibility codes from the authoritative Manus fiscal domain. The system SHALL reject unsupported responsibility codes and SHALL never mass-default `R-99-PN`.

#### Scenario: Controlled selections
- **WHEN** an operator edits a fiscal profile
- **THEN** person type, tax regime, and responsibilities are selected from controlled options

#### Scenario: Unsupported responsibility
- **WHEN** an update contains a responsibility outside the supported domain
- **THEN** the update is rejected with a field-specific validation error

#### Scenario: No blind default
- **WHEN** a profile lacks fiscal responsibilities
- **THEN** the system leaves it incomplete and does not assign `R-99-PN`

### Requirement: Canonical geographic and fiscal validation
Customer and supplier updates SHALL use the existing cascading country/department/municipality selectors and SHALL resolve canonical catalog codes server-side. A normal profile SHALL become complete only when required fiscal and geographic fields are present and consistent. Final-consumer behavior SHALL remain unchanged.

#### Scenario: Valid reviewed profile
- **WHEN** an operator submits valid fiscal values and related catalog IDs
- **THEN** the API persists canonical codes, marks the source `MANUAL`, and retains `is_dian_validated=false`

#### Scenario: Invalid location relationship
- **WHEN** a municipality does not belong to the selected department
- **THEN** the API rejects the update and persists no inconsistent codes

### Requirement: Billing eligibility remains fail-closed
Electronic billing SHALL use the reviewed canonical fiscal/geographic values in new immutable snapshots and SHALL reject incomplete normal customer profiles. Existing snapshots and documents SHALL NOT be changed by review edits.

#### Scenario: Complete customer snapshot
- **WHEN** a complete customer is used for a new billing document
- **THEN** the snapshot contains the current canonical reviewed values immutably

#### Scenario: Incomplete customer
- **WHEN** a normal customer lacks a required fiscal field
- **THEN** billing stops with an actionable validation error before provider submission
