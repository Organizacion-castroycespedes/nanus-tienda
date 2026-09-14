## ADDED Requirements

### Requirement: Catalog-backed supplier location
Suppliers SHALL use the same authoritative country → department → municipality hierarchy and server-side code resolution as customers.

#### Scenario: Complete supplier creation
- **WHEN** valid catalog IDs are submitted
- **THEN** the API persists canonical geographic IDs and codes plus compatible legacy labels

#### Scenario: Invalid supplier hierarchy
- **WHEN** a selected municipality or department is outside the selected parent
- **THEN** the API rejects the request without mutation

### Requirement: Supplier fiscal profile
Suppliers SHALL persist supported person type, tax regime, and controlled multiple tax responsibilities when required by the supplier domain.

#### Scenario: Unsupported responsibility
- **WHEN** a responsibility is not in the authoritative catalog/domain
- **THEN** the API rejects it and does not default the supplier profile

#### Scenario: Edit hydration
- **WHEN** an existing supplier is edited
- **THEN** the Web form hydrates selectors from persisted references/codes and does not offer free-text geographic codes
