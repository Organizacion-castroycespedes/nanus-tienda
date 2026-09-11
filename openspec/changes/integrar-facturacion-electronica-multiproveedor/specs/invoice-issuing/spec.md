## ADDED Requirements

### Requirement: Invoice issuance is optional per tenant
The system SHALL allow invoice issuance only when the tenant has an enabled provider configuration and SHALL leave the source sale unchanged when billing is disabled.

#### Scenario: Tenant billing is disabled
- **WHEN** a sale is finalized for a tenant without electronic billing enabled
- **THEN** the sale completes normally
- **AND** no electronic invoice document is created

#### Scenario: Tenant billing is enabled
- **WHEN** a sale is finalized for a tenant with an enabled provider
- **THEN** the system creates a neutral invoice document from the sale snapshot
- **AND** the billing domain can continue with provider-specific processing later

#### Scenario: Source sale remains authoritative
- **WHEN** an invoice is issued
- **THEN** the source sale totals, taxes, and payments remain unchanged by the billing adapter

