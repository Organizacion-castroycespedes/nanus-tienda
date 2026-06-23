## ADDED Requirements

### Requirement: Delivery creation source flow
The delivery creation form SHALL support manual, order-based, and sale-based creation flows without requiring users to type internal IDs.

#### Scenario: Manual delivery calculates total from delivery fee
- **WHEN** a user creates a delivery without selecting an order or sale
- **THEN** the form sets source subtotal to zero
- **AND** the total equals the delivery fee

#### Scenario: Order-based delivery uses order amount as subtotal
- **WHEN** a user selects an eligible order
- **THEN** the form records `order_id`
- **AND** the form uses the order amount as subtotal
- **AND** the total equals order subtotal plus delivery fee

#### Scenario: Sale-based delivery uses sale amount as subtotal
- **WHEN** a user selects a sale or factura
- **THEN** the form records `sale_id`
- **AND** the form uses the sale amount as subtotal
- **AND** the total equals sale subtotal plus delivery fee

#### Scenario: Sale associated with an order preserves both references
- **WHEN** a selected sale has an associated order
- **THEN** the form records both `sale_id` and `order_id`
- **AND** the delivery stores both references when created

#### Scenario: Form hides technical IDs from normal entry
- **WHEN** the user creates a delivery through the form
- **THEN** the user chooses customer, order, or sale options from labels
- **AND** the user is not required to type UUID values manually

### Requirement: Delivery customer search
The delivery creation form SHALL allow searching customers beyond the initially loaded visible options.

#### Scenario: User searches by name
- **WHEN** a user enters customer name text
- **THEN** the customer selector shows matching active customers for the tenant

#### Scenario: User searches by document
- **WHEN** a user enters a customer document number
- **THEN** the customer selector shows matching active customers for the tenant

#### Scenario: User searches by phone or email when supported
- **WHEN** a user enters phone or email text
- **THEN** the customer selector searches supported identity fields and shows matching active customers

#### Scenario: Selecting customer preloads contact data
- **WHEN** a user selects a customer
- **THEN** the form preloads contact name, phone, and primary address when available

#### Scenario: Selecting customer loads related sources
- **WHEN** a user selects a customer
- **THEN** the form loads related eligible orders
- **AND** the form loads related sales/facturas when the current user can access the sales service

### Requirement: Delivery duplicate prevention
The system SHALL prevent duplicate deliveries for the same order or sale flow.

#### Scenario: Existing delivery for order is detected
- **WHEN** a selected order already has a delivery
- **THEN** the form warns the user and exposes a way to manage the existing delivery
- **AND** the form does not submit a duplicate delivery for that order

#### Scenario: Existing delivery for sale is detected
- **WHEN** a selected sale already has a delivery
- **THEN** the form warns the user and exposes a way to manage the existing delivery
- **AND** the form does not submit a duplicate delivery for that sale

#### Scenario: Manual delivery remains allowed
- **WHEN** the user creates a delivery without order or sale
- **THEN** duplicate checks for order and sale do not block creation

### Requirement: Delivery totals calculation
The delivery creation form SHALL calculate subtotal and total consistently from selected source and delivery fee.

#### Scenario: Manual source subtotal is zero
- **WHEN** no order or sale source is selected
- **THEN** the calculated source subtotal is zero

#### Scenario: Order source subtotal is read from order amount
- **WHEN** an order source is selected
- **THEN** the calculated source subtotal comes from the order amount, or zero if missing

#### Scenario: Sale source subtotal is read from sale amount
- **WHEN** a sale source is selected
- **THEN** the calculated source subtotal comes from the sale amount, or zero if missing

#### Scenario: Total equals subtotal plus delivery fee
- **WHEN** the delivery fee changes
- **THEN** the form recalculates total as source subtotal plus delivery fee

#### Scenario: Total is readonly and calculated
- **WHEN** the form shows subtotal and total
- **THEN** total is readonly
- **AND** source subtotal is readonly when selected from order or sale

#### Scenario: Negative delivery fee is rejected
- **WHEN** the user enters a negative delivery fee
- **THEN** the form blocks creation with a clear validation message
