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

#### Scenario: API produces neutral event only
- **WHEN** a sale completes
- **THEN** the API SHALL publish a neutral integration event
- **AND** it SHALL NOT build canonical billing commands
