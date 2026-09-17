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

### Requirement: FactuCore invoice requests use the canonical payments array
The Manus FactuCore adapter SHALL serialize mixed and single payments through `payments[]`.
Each item SHALL contain only `amount`, `reference` when present, `paymentMeansCode`,
`paymentMeansId`, and `requiresReference` when present. The adapter SHALL NOT duplicate
payment data in root-level `amount`, `reference`, `requiresReference`, `term`, `paymentMeansCode`,
`paymentMeansId`, or `dueDate` fields. The FactuCore external invoice boundary SHALL retain
`whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.

#### Scenario: Mixed payment request crosses the FactuCore boundary
- **WHEN** a sale has three payments
- **THEN** Manus sends exactly three entries in `payments[]`
- **AND** each entry contains only fields accepted by `ElectronicPaymentDto`
- **AND** the request passes the real FactuCore invoice `ValidationPipe` and normalizes to three payments

#### Scenario: Single legacy payment remains compatible
- **WHEN** a legacy caller supplies one internal `payment` object
- **THEN** the adapter maps it to one canonical `payments[]` entry
- **AND** no unsupported root or nested payment fields are serialized

#### Scenario: Unknown payment fields remain rejected
- **WHEN** a request contains an unknown root or nested payment property
- **THEN** FactuCore rejects it with `forbidNonWhitelisted`
- **AND** the global whitelist behavior is not weakened

