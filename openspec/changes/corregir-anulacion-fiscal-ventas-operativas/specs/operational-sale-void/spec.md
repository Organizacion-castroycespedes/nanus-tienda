# Capability: operational-sale-void

## ADDED Requirements

### Requirement: fiscal state gate
The system SHALL reject void preparation for a sale with an electronic invoice unless the invoice status is `ACCEPTED`.

#### Scenario: invoice is not accepted
- **WHEN** a sale has an electronic invoice with status `PENDING`, `PROCESSING`, `REJECTED`, or `TECHNICAL_ERROR`
- **THEN** the API rejects the void request and explains that fiscal status must be reconciled first

### Requirement: accepted invoice reversal
The system SHALL use an accepted credit note to reverse a sale whose electronic invoice is `ACCEPTED`.

#### Scenario: credit note is accepted
- **WHEN** the credit note for an accepted invoice is accepted by the fiscal provider
- **THEN** the sale is voided and the void request is completed

### Requirement: local void
The system SHALL allow a local void for a sale without an electronic invoice.

#### Scenario: no electronic invoice exists
- **WHEN** the sale has no electronic billing document
- **THEN** the UI offers local void and the API applies the local reversal without creating a credit note

### Requirement: financial reversal
The system SHALL set the final sale status to `REFUNDED` when the sale has completed payments, otherwise `CANCELLED`, and reset paid amount and balances to zero.

#### Scenario: completed payment exists
- **WHEN** a void is applied to a sale with at least one completed payment
- **THEN** the sale status is `REFUNDED`, all balances are zero, and payment status is `PENDING`

### Requirement: visible decision
The UI SHALL show whether void is hidden, local, credit-note based, or blocked by electronic billing status.

#### Scenario: user opens void modal
- **WHEN** the sale detail is loaded
- **THEN** the action and explanatory message match the sale status and electronic billing status
