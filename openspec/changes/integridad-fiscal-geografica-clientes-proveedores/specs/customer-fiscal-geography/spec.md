## ADDED Requirements

### Requirement: Catalog-backed customer location
Customers SHALL persist country, department, and municipality selected from the authoritative catalog hierarchy, with canonical codes resolved server-side.

#### Scenario: Complete customer creation
- **WHEN** a tenant user submits valid country, department, municipality, and fiscal fields
- **THEN** the API verifies hierarchy ownership and stores reference IDs, canonical codes, and compatible legacy labels

#### Scenario: Invalid hierarchy
- **WHEN** municipality does not belong to the selected department or department does not belong to the selected country
- **THEN** the API rejects the request without changing the customer

### Requirement: Customer fiscal completeness
Normal customers SHALL require the existing domain-required person type, tax regime, and at least one valid controlled tax responsibility; no responsibility SHALL be guessed.

#### Scenario: Missing fiscal profile
- **WHEN** a normal customer lacks a required fiscal field
- **THEN** the API rejects creation/update with actionable field errors

#### Scenario: Final consumer
- **WHEN** a customer is marked `is_final_consumer`
- **THEN** the API applies only the documented existing fiscal exception and does not silently assign `R-99-PN`

### Requirement: Customer billing snapshot
Electronic-billing snapshots SHALL use canonical persisted customer geographic and fiscal values and SHALL remain immutable after document creation.

#### Scenario: Eligible snapshot
- **WHEN** a customer has complete canonical data
- **THEN** billing eligibility passes and the snapshot contains codes and fiscal values from persistence

#### Scenario: Incomplete snapshot
- **WHEN** canonical location or required fiscal data is missing
- **THEN** billing eligibility fails closed before provider-bound document creation
