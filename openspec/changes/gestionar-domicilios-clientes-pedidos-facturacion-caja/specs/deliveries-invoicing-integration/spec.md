## ADDED Requirements

### Requirement: Deliveries can link to sales or invoices
The system SHALL define that a delivery can be associated with a sale or invoice when delivery execution depends on a billed document.

#### Scenario: Delivery exists before invoice
- **WHEN** a delivery starts from an order before invoicing
- **THEN** the delivery can later reference the resulting sale or invoice for traceability

#### Scenario: Delivery exists after invoice
- **WHEN** a user creates a delivery from an already billed sale or invoice
- **THEN** the delivery references the billed document and keeps its own delivery lifecycle

### Requirement: Shipping value has one financial source of truth
The system SHALL require a future implementation decision for whether the delivery or shipping value is part of the invoice/POS sale or an operational-only charge.

#### Scenario: Shipping is charged to customer
- **WHEN** the delivery value is charged to the customer
- **THEN** the value must be represented in the financial/fiscal source of truth before cash collection is finalized

#### Scenario: Shipping is internal cost
- **WHEN** the delivery value is not charged to the customer
- **THEN** the value can remain operational and must not be collected as invoice revenue

#### Scenario: Value mismatch is detected
- **WHEN** delivery value, invoice value and collected value do not match expected rules
- **THEN** the future system must flag the difference for review instead of silently adjusting money

### Requirement: Invoice annulment preserves delivery traceability
The system SHALL preserve delivery history when a linked invoice is annulled, reversed or adjusted with a credit note.

#### Scenario: Invoice annulled before dispatch
- **WHEN** a linked invoice is annulled while delivery is `PENDIENTE` or `EN_PREPARACION`
- **THEN** the future system should cancel or block dispatch of the delivery with a traceable reason

#### Scenario: Invoice annulled after delivery
- **WHEN** a linked invoice is annulled after delivery is `ENTREGADO`
- **THEN** the delivery remains historically delivered and the financial reversal is handled by invoice/cash/credit-note traceability

#### Scenario: Invoice annulled after failed delivery
- **WHEN** a linked invoice is annulled after delivery is `NO_ENTREGADO`
- **THEN** the future system records both the failed delivery and financial resolution path

### Requirement: No invoicing implementation in this phase
The system SHALL NOT modify invoicing APIs, SQL functions, invoice documents, fiscal behavior or electronic invoicing behavior during this OpenSpec-only phase.

#### Scenario: Invoicing integration is validated
- **WHEN** this change is validated
- **THEN** invoicing behavior remains documentation-only and existing billing flows stay untouched

### Requirement: Invoice and sale technical references
The system SHALL document future `sale_id` and `invoice_id` references without assuming the final fiscal storage model.

#### Scenario: POS sale is the source document
- **WHEN** a future delivery is linked to a POS sale
- **THEN** the delivery can store `sale_id` as the source reference

#### Scenario: Fiscal invoice is separate
- **WHEN** the future fiscal model uses a separate invoice entity
- **THEN** the delivery can store `invoice_id` after confirming same-tenant rules and fiscal traceability

#### Scenario: Invoice model is unresolved
- **WHEN** implementation starts before the fiscal invoice model is confirmed
- **THEN** the design must not guess a foreign key that could break sales or electronic invoicing

### Requirement: Delivery fee source is explicit
The system SHALL document `delivery_fee_source` to prevent double counting between delivery, sale, invoice and cash.

#### Scenario: Fee is included in invoice or sale
- **WHEN** the delivery fee is included in the billed document
- **THEN** the delivery records the source as `INVOICE` or `POS_SALE` and must not create a separate income movement for the same fee

#### Scenario: Fee is operationally separate
- **WHEN** the delivery fee is not part of sale or invoice totals
- **THEN** the delivery records the source as `OPERATIVE_SEPARATE` and requires future financial handling before collection

#### Scenario: No fee exists
- **WHEN** the delivery has no fee
- **THEN** the delivery records a no-fee source such as `NONE`

### Requirement: Backend invoice integration plan
The system SHALL document invoice and sale integration risks before backend runtime work begins.

#### Scenario: Invoice storage is unresolved
- **WHEN** backend implementation planning reviews `invoiceId`
- **THEN** it must record whether the reference maps to `sales`, a fiscal invoice table or a future external document before creating a foreign key

#### Scenario: Fee source enum is finalized
- **WHEN** backend enums are implemented
- **THEN** the delivery fee source names must be aligned to the final sale/invoice/cash model to avoid duplicate revenue

#### Scenario: Invoice annulment remains isolated
- **WHEN** delivery backend is first implemented
- **THEN** it must not alter invoice annulment behavior until an explicit integration phase is approved
