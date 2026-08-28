## ADDED Requirements

### Requirement: Document lines are persisted as historical snapshots
The system SHALL persist each electronic document line as a historical snapshot with description, quantity, unit, unit price, discount, subtotal, taxes, totals, and provider line reference.

#### Scenario: Product catalog changes after issuance
- **WHEN** a product name or price changes after the document is issued
- **THEN** the historical line snapshot remains unchanged

#### Scenario: Credit note needs origin line
- **WHEN** a credit note references an original invoice line
- **THEN** the system can store the original provider line id and source line id

#### Scenario: Tax snapshot is needed
- **WHEN** a line has taxes
- **THEN** the line snapshot keeps the tax values that applied at issuance time

