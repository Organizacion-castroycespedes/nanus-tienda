# Electronic Billing Service Boundary

## ADDED Requirements

### Requirement: API boundary after cutover

After cutover, the API SHALL NOT depend on:

- `ElectronicBillingService`
- `ElectronicBillingProcessingService`
- `ElectronicBillingProvider`
- `FactuCore*`
- `electronic_*` repositories

The API SHALL only know that a business event requires electronic billing.

The billing backend SHALL own the billing application services and provider orchestration.

The API MAY own a generic integration outbox and dispatcher, but it SHALL NOT own canonical billing commands or provider runtime after cutover.

#### Scenario: API boundary stays neutral after cutover
- **WHEN** the API handles a completed sale
- **THEN** it SHALL only emit a neutral billing event boundary
- **AND** it SHALL NOT depend on billing application services or provider runtime

### Requirement: Billing credentials remain in billing backend

The API SHALL NOT store or resolve provider secrets.

The API MAY store only a neutral `credential_reference` if a sale event needs to be produced before billing processing.

The billing backend SHALL own secret resolution, provider credential validation, and provider runtime credential injection.

#### Scenario: API never resolves provider secrets
- **WHEN** the API prepares a billing-related sale flow
- **THEN** it SHALL only carry the neutral credential reference
- **AND** it SHALL NOT resolve provider secrets or inject provider credentials

#### Scenario: API produces neutral event only
- **WHEN** a sale completes
- **THEN** the API SHALL publish a neutral integration event
- **AND** it SHALL NOT build canonical billing commands
