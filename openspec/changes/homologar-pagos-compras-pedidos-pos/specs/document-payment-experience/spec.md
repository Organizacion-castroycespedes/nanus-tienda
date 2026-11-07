## Purpose

Unificar la experiencia de pago de compras y pedidos con el lenguaje visual POS, preservando tercero de origen, abonos y efectos financieros de cada dominio.

## ADDED Requirements

### Requirement: Contextual payment dialog
The system SHALL present purchase and order payment in a compact responsive dialog using the POS visual language, source context, method cards, amount/reference inputs, financial summary and explicit cancel/confirm actions.

#### Scenario: Purchase deep link
- **WHEN** an operator opens a valid purchase payment deep link
- **THEN** Pagar compra opens over purchase context without breaking the route contract

#### Scenario: Narrow viewport
- **WHEN** a payment dialog is opened on a narrow screen
- **THEN** controls and summary stack without horizontal scrolling and actions remain reachable

### Requirement: Source party is authoritative
The system SHALL display the purchase supplier or order customer from the source document as read-only and SHALL NOT duplicate or replace that relation in the payment flow.

#### Scenario: Order customer
- **WHEN** an existing order is collected
- **THEN** Cliente del pedido displays its associated customer without an arbitrary customer selector

#### Scenario: Purchase supplier
- **WHEN** a purchase is paid
- **THEN** Proveedor de la compra displays its associated supplier without changing historical persistence

#### Scenario: Missing party
- **WHEN** the required source party identifier is absent
- **THEN** confirmation is blocked with a clear error

### Requirement: Pending amount defaults and exact split arithmetic
The system SHALL propose the current pending amount on opening and the uncovered remainder when adding a method, with two-decimal monetary precision and immediate summary updates.

#### Scenario: Initial purchase amount
- **WHEN** total is 35000000 and previously paid is zero
- **THEN** the first proposed amount is 35000000 rather than zero

#### Scenario: Remaining split amount
- **WHEN** the first line is 10000000 against pending 35000000 and a second method is added
- **THEN** the second proposed amount is 25000000 and tracks preceding edits until manually edited

### Requirement: Partial payments and domain semantics
The system SHALL preserve purchase and order partial payments, configured reference requirements, optional payment notes, cash-session rules, and backend financial states. Purchase payments SHALL use OUT, order collections SHALL use IN, and both SHALL reject unsupported overpayment without POS-style change.

#### Scenario: Partial purchase
- **WHEN** 10000000 is paid against pending 35000000
- **THEN** paid increases by 10000000, pending becomes 25000000 and backend partial financial status is displayed without change

#### Scenario: Full order collection
- **WHEN** the entire pending order amount is collected
- **THEN** its customer remains unchanged, the movement is IN and refreshed backend status is fully paid

#### Scenario: Cash purchase
- **WHEN** a purchase is paid in cash from an authorized open session
- **THEN** the financial movement uses OUT and references the actual session

### Requirement: Safe financial confirmation
The system SHALL prevent repeated confirmation, persist supported split lines as one consistent operation, reject stale unsupported balances server-side, and never silently retry an ambiguous financial result.

#### Scenario: Double confirmation
- **WHEN** confirmation is activated repeatedly during submission
- **THEN** only one logical operation is sent and controls show loading

#### Scenario: Second method rejected
- **WHEN** a split operation contains a rejected payment line
- **THEN** the operation does not leave a silently partial committed split or report success

#### Scenario: Stale balance
- **WHEN** another operator reduces the pending amount before confirmation
- **THEN** the backend rejects an excess allocation without invalid financial movements

#### Scenario: Unknown result
- **WHEN** submission loses its response or receives an unexpected response
- **THEN** the dialog reports uncertainty, does not mark success and prevents blind resubmission

### Requirement: Accessible operator lifecycle
The system SHALL contain and restore focus, support keyboard method selection and Escape when idle, show selected state beyond color, and prevent Enter in amount/reference fields from confirming a transaction.

#### Scenario: Amount keyboard use
- **WHEN** Enter is pressed while editing an amount or reference
- **THEN** no payment is submitted

#### Scenario: Close and restore
- **WHEN** an idle dialog is closed
- **THEN** focus returns to its opening context and no payment is created

### Requirement: Small viewport payment operation
The system SHALL keep document payment inside the visible viewport at supported narrow widths and short heights, with only the payment body scrolling, actions reachable, method cards wrapped, and background page scrolling disabled while open.

#### Scenario: Short POS display
- **WHEN** a purchase or order payment is opened at 1024x600 with three payment lines
- **THEN** the dialog fits within viewport margins, header remains understandable, body scrolls internally, and confirm/cancel actions remain reachable

#### Scenario: Responsive width
- **WHEN** payment is opened at 1024px or less
- **THEN** summary cards use a compact grid or stack, fields avoid horizontal overflow, and payment-method cards wrap without a horizontal scrollbar

#### Scenario: Background scroll lock
- **WHEN** the payment dialog is active
- **THEN** the document behind it cannot become the scrolling surface and focus remains within the dialog until close

### Requirement: Preserve POS and refresh document state
The system SHALL preserve existing POS customer selection, method handling, change and confirmation behavior while refreshing document totals/status and showing success after confirmed document payment.

#### Scenario: POS regression
- **WHEN** an operator opens Cobrar venta, changes methods and confirms a valid sale
- **THEN** the existing sale flow continues to function with its existing business rules

#### Scenario: Successful document payment
- **WHEN** payment succeeds
- **THEN** the dialog closes cleanly and document financial values refresh without a hard reload

### Requirement: Durable document payment replay safety
The system SHALL accept one stable operation UUID for each document-payment confirmation, scope its uniqueness by tenant, and persist the canonical request fingerprint and committed payment IDs with the same transaction as all financial writes.

#### Scenario: Same operation replay
- **WHEN** the same tenant retries a committed operation with the same key and materially identical payment payload
- **THEN** the API returns the previously committed payment result without creating new payments, allocations or cash movements

#### Scenario: Same key changed payload
- **WHEN** a key is reused with a different document, method, amount, reference or note
- **THEN** the API rejects the request with a conflict and creates no financial effect

#### Scenario: Concurrent same key
- **WHEN** two requests with the same tenant, key and payload arrive concurrently
- **THEN** PostgreSQL uniqueness and transaction locking allow one logical operation and the other recovers its committed result

#### Scenario: Legacy caller
- **WHEN** an existing caller omits the optional operation key
- **THEN** the document payment remains backward compatible while new clients can opt into replay-safe recovery

### Requirement: Financial institution parity for document payment lines
The system SHALL reuse the POS financial-institution selection experience for purchase and order payment lines, SHALL require an institution when the selected payment method requires one, and SHALL transmit and persist the selected institution with the payment.

#### Scenario: Cash without institution
- **WHEN** a document payment line uses an active cash method
- **THEN** the line remains valid without a financial institution and persists a null institution

#### Scenario: Method requiring institution
- **WHEN** a document payment line uses a method configured to require a financial institution
- **THEN** the operator must select an active institution visible to the current tenant or global before confirmation, without requiring a method association

#### Scenario: Mixed payment
- **WHEN** a document payment combines cash and a method requiring an institution
- **THEN** each line preserves its own optional institution, amount, reference and notes in the same atomic operation

### Requirement: Server-authoritative institution validation
The system SHALL validate every submitted financial institution inside the existing document-payment transaction against active status and tenant or global visibility. The document-payment path SHALL NOT require an active `payment_method_financial_institutions` association. The institution SHALL be part of the canonical idempotency fingerprint.

#### Scenario: Invalid or foreign institution
- **WHEN** a client submits an inactive or other-tenant institution
- **THEN** the complete document payment is rejected and no payment, allocation, cash movement, document-state or operation completion is committed

#### Scenario: Active institution without method association
- **WHEN** a purchase or order payment selects an active tenant-visible or global institution with no row in `payment_method_financial_institutions`
- **THEN** the complete document payment can commit and persists that institution when every other validation passes

#### Scenario: Same key with changed institution
- **WHEN** a committed operation key is replayed with a different financial institution on any line
- **THEN** the API rejects the replay as a changed payload without new financial effects

#### Scenario: Older client without institution
- **WHEN** an older client omits the optional institution for a method that does not require one
- **THEN** the payment remains compatible and persists a null institution

### Requirement: POS financial-institution non-regression
The system SHALL preserve the existing POS behavior that loads the active tenant-visible/global financial-institution catalog without a payment-method filter. Document-payment changes SHALL NOT replace that catalog, selector validation or sale submission contract with method-associated behavior.

#### Scenario: POS global active catalog
- **WHEN** POS opens its payment dialog for a method requiring an institution
- **THEN** it shows the active tenant-visible/global catalog returned by `listFinancialInstitutions()` using the existing search, category and selection behavior

#### Scenario: POS catalog with no mappings
- **WHEN** active institutions exist but the selected method has no rows in `payment_method_financial_institutions`
- **THEN** POS still shows the active catalog exactly as before this change

#### Scenario: Document changes do not alter sale policy
- **WHEN** document payments use the active and tenant-visible/global institution policy
- **THEN** POS sale creation retains that same pre-change policy and no POS source file or sale contract is modified

### Requirement: Responsive orders workspace
The orders workspace SHALL use the available desktop width and SHALL preserve readable order and product information across wide, intermediate and narrow viewports without changing order or payment behavior.

#### Scenario: Wide desktop list
- **WHEN** the orders page is displayed at 1440 px or 1920 px
- **THEN** the orders table fills the available content width and uses stable column allocation for descriptive, monetary, status and action content

#### Scenario: Intermediate or narrow list
- **WHEN** the orders table cannot fit at 1180, 1024, 768 or 390 px
- **THEN** the table retains its readable minimum width inside a labelled keyboard-focusable horizontal scroll region without page-level overlap

#### Scenario: Long order and product names
- **WHEN** a customer, branch, terminal or selected product has a long name
- **THEN** descriptive content wraps within its allocated area while amounts and actions remain legible and available

#### Scenario: Responsive filters
- **WHEN** the viewport changes between mobile and wide desktop breakpoints
- **THEN** filters compact progressively without hiding, reordering semantically or changing any filter behavior

#### Scenario: Product detail presentations
- **WHEN** an operator edits, delivers or invoices an order containing multiple or long-named products
- **THEN** product descriptions retain useful width, numeric values remain aligned and the presentation uses controlled horizontal scrolling when required

#### Scenario: Orders behavior non-regression
- **WHEN** the responsive layout is applied
- **THEN** loading, empty state, pagination, action-menu keyboard behavior, order calculations, callbacks and document-payment behavior remain unchanged
