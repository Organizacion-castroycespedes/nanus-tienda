## ADDED Requirements

### Requirement: Delivery quick creation uses operational fields
The system SHALL provide a delivery quick-create flow where the seller uses business selectors and readable labels instead of typing technical identifiers.

#### Scenario: Authorized seller opens quick creation
- **WHEN** an authorized user with delivery create access opens the delivery creation flow
- **THEN** the system shows operational fields for cliente, contacto, telefono, direccion, sucursal, metodo de pago, pedido opcional, venta/factura opcional, valor domicilio, subtotal, total and notas
- **AND** the visible labels MUST NOT use `customer_id`, `branch_id`, `order_id`, `sale_id` or `payment_method_id`

#### Scenario: Selected records map to create payload
- **WHEN** the seller selects customer, branch, order, sale or payment method options and submits the form
- **THEN** the system maps selected records to the existing delivery create payload identifiers internally
- **AND** the seller does not need to type raw UUID values

### Requirement: Customer selector preloads delivery contact data
The system SHALL let the seller search and select an existing customer and SHALL preload available delivery contact data from that customer.

#### Scenario: Customer is selected
- **WHEN** the seller selects a customer from the customer search results
- **THEN** the system fills contact name from the customer name when available
- **AND** fills phone and delivery address from the customer record when available

#### Scenario: Customer has no usable address
- **WHEN** the selected customer has no usable delivery address
- **THEN** the system keeps the address field editable and requires the seller to provide a delivery address before saving

#### Scenario: No existing customer is selected
- **WHEN** the seller creates a delivery without selecting an existing customer
- **THEN** the system allows manual contact and phone capture
- **AND** requires enough delivery data to create the delivery

### Requirement: Customer address options are selectable when available
The system SHALL present available customer delivery address options when more than one address source exists and SHALL keep a delivery snapshot in the create payload.

#### Scenario: Multiple address options exist
- **WHEN** a selected customer has multiple available address options from customer data or source documents
- **THEN** the seller can choose one address option for the delivery
- **AND** the selected address is copied into the delivery address snapshot fields

#### Scenario: Address is manually edited
- **WHEN** the seller edits the preloaded address or reference
- **THEN** the system saves the edited address and reference in the delivery payload
- **AND** does not mutate the customer address record

### Requirement: Branch is inferred before showing a selector
The system SHALL infer the delivery branch from authenticated or operational context when available and SHALL show a branch selector only when the branch cannot be resolved confidently.

#### Scenario: Branch exists in session or context
- **WHEN** the user has a current POS branch context or an authenticated assigned branch
- **THEN** the delivery creation flow preselects that branch
- **AND** shows the branch name instead of a technical `branch_id` field

#### Scenario: Branch cannot be inferred
- **WHEN** no branch can be inferred from session, context or a single active branch
- **THEN** the system shows a selector of active tenant branches
- **AND** requires a branch selection before saving when the backend requires branch scope

### Requirement: Payment method is selected from active methods
The system SHALL replace manual payment method id entry with a selector of active payment methods available for the tenant.

#### Scenario: Payment methods load
- **WHEN** the creation flow loads active payment methods
- **THEN** the seller can select a method by visible name and type
- **AND** the system stores the selected method id internally as `payment_method_id`

#### Scenario: Payment method is required by current business rule
- **WHEN** the backend or source document requires a payment method for the delivery
- **THEN** the system blocks save until the seller selects a payment method
- **AND** the validation message uses "metodo de pago" instead of `payment_method_id`

### Requirement: Order selector is optional and customer-scoped
The system SHALL provide an optional order selector filtered to the selected customer when order data is available.

#### Scenario: Customer orders are available
- **WHEN** a customer is selected and the system can load that customer's orders
- **THEN** the seller can optionally select a visible order option showing date, status and total
- **AND** the system stores the selected order id internally as `order_id`

#### Scenario: Order is selected
- **WHEN** the seller selects an order
- **THEN** the system preloads available contact, phone, address, branch, subtotal and total from the order
- **AND** does not change order status, totals, payments or inventory

#### Scenario: No order is selected
- **WHEN** the seller leaves the order selector empty
- **THEN** the delivery can still be created manually if minimum delivery fields are valid

### Requirement: Sale or invoice selector is optional and customer-scoped
The system SHALL provide an optional sale/factura selector filtered to the selected customer when sale or invoice data is available.

#### Scenario: Customer sales or invoices are available
- **WHEN** a customer is selected and the system can load that customer's sales or invoice-backed records
- **THEN** the seller can optionally select a visible sale/factura option showing date, document number or short id, status and total
- **AND** the system stores the selected sale id internally as `sale_id` when the current backend source is `sales`

#### Scenario: Sale or invoice is selected
- **WHEN** the seller selects a sale or factura source
- **THEN** the system preloads available contact, phone, address, branch, subtotal and total from that source
- **AND** does not modify POS, caja, sale totals, taxes or electronic invoicing

#### Scenario: No sale or invoice is selected
- **WHEN** the seller leaves the sale/factura selector empty
- **THEN** the delivery can still be created manually if minimum delivery fields are valid

### Requirement: Totals are calculated from source or manual values
The system SHALL calculate subtotal and total for the delivery from selected order or sale/factura data, while preserving manual entry when no source is selected.

#### Scenario: Delivery comes from order
- **WHEN** an order with a total is selected
- **THEN** the delivery subtotal and total are prefilled from the order total
- **AND** the seller can review the values before saving

#### Scenario: Delivery comes from sale or invoice
- **WHEN** a sale or factura with a total is selected
- **THEN** the delivery subtotal and total are prefilled from the sale or factura total
- **AND** the seller can review the values before saving

#### Scenario: Manual delivery has no source
- **WHEN** no order, sale or factura source is selected
- **THEN** the seller can enter delivery fee, subtotal and total manually
- **AND** the system validates value domicilio when it applies to the delivery

### Requirement: Minimum fields are validated with non-technical messages
The system SHALL validate the minimum fields needed to create an executable delivery and SHALL show messages written for store operators.

#### Scenario: Missing identity and contact data
- **WHEN** the seller submits without selected customer and without enough manual contact or phone data
- **THEN** the system blocks creation and asks for cliente, contacto or telefono using non-technical wording

#### Scenario: Missing delivery address
- **WHEN** the seller submits without delivery address
- **THEN** the system blocks creation and asks for direccion de entrega using non-technical wording

#### Scenario: Missing delivery value when applicable
- **WHEN** delivery value is required by the current selected source or manual mode and no value is provided
- **THEN** the system blocks creation and asks for valor domicilio using non-technical wording

### Requirement: Quick creation stays isolated from excluded modules
The system SHALL keep quick delivery creation isolated from caja, POS, electronic invoicing, functional order changes, courier assignment and delivery state changes.

#### Scenario: Delivery is saved from quick creation
- **WHEN** the seller submits a valid quick-create form
- **THEN** the system creates only a delivery record through the delivery creation flow
- **AND** does not create cash movements, POS changes, electronic invoicing changes, order mutations, courier assignments or state transitions beyond the normal initial delivery state

#### Scenario: Source selector reads related records
- **WHEN** the flow loads customer orders, sales or invoice-backed records for selectors
- **THEN** those reads are tenant-scoped and read-only
- **AND** they do not alter the selected source records

### Requirement: Quick creation is responsive
The system SHALL keep the delivery quick-create flow usable on desktop and mobile without global horizontal overflow.

#### Scenario: Mobile viewport opens quick creation
- **WHEN** the quick-create flow is viewed on a narrow mobile viewport
- **THEN** fields stack or wrap within the viewport
- **AND** selectors, validation messages and action buttons remain readable and tappable without global horizontal scrolling

#### Scenario: Desktop viewport opens quick creation
- **WHEN** the quick-create flow is viewed on desktop
- **THEN** fields are grouped for fast scanning
- **AND** dynamic labels, selected option text and validation messages do not overlap adjacent content
