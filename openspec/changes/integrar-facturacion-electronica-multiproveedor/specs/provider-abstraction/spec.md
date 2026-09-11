## ADDED Requirements

### Requirement: Electronic billing providers are adapter based
The system SHALL define a provider adapter boundary that accepts canonical document commands and hides provider-specific step counts and transport details from sales and return flows.

#### Scenario: Provider uses one call
- **WHEN** a provider can issue an invoice with a single HTTP request
- **THEN** the Manus domain still invokes the same canonical adapter contract
- **AND** the sales flow does not change to follow vendor-specific steps

#### Scenario: Provider uses multiple steps
- **WHEN** a provider requires create, generate XML, sign, and transmit steps
- **THEN** the Manus domain still sees one provider abstraction
- **AND** the adapter owns the internal sequencing

#### Scenario: Future provider is added
- **WHEN** a second provider is introduced later
- **THEN** the new provider can be registered without modifying `SaleService` or `ReturnService`

### Requirement: Provider mappers normalize business payment values
Provider adapters SHALL translate business payment values into the provider's fiscal contract before constructing an outbound request.

#### Scenario: Manus cash payment targets FactuCore
- **WHEN** the canonical payment method is `CASH`
- **THEN** the FactuCore request SHALL use `paymentMeansCode = "10"`
- **AND** the FactuCore request SHALL use `paymentMeansId = "1"`
- **AND** the business value `CASH` SHALL NOT be passed through either fiscal field

#### Scenario: Unsupported payment value
- **WHEN** a payment value has no explicit provider mapping
- **THEN** the provider mapper SHALL fail before constructing the provider request
- **AND** the business value SHALL NOT be passed through as a fiscal code

