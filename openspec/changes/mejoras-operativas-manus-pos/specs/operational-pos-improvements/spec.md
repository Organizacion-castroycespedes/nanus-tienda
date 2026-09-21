## ADDED Requirements

### Requirement: POS client selector is stable and alphabetic
The client selector in Cobrar venta SHALL preserve the existing search, document display, selected customer, and sale rules while presenting results in ascending Spanish alphabetical order, case-insensitively, with stable original-order ties.

#### Scenario: Results are ordered without changing selection
- **WHEN** matching customers are displayed
- **THEN** names are ordered A-Z using Spanish locale comparison and the selected customer remains selected

### Requirement: Inventory dashboard uses demonstrated data
The inventory dashboard SHALL preserve the existing dashboard contract and SHALL NOT present `summary.stockTotal` as currency or invent product-count metrics. `inventoryCostTotal` SHALL be calculated and returned by the backend from the demonstrated persisted cost source.

#### Scenario: Inventory cost is available
- **WHEN** the dashboard endpoint has a determined cost source
- **THEN** the response includes `inventoryCostTotal` and the UI formats it as currency without recalculating it

#### Scenario: Cost source is not determined
- **WHEN** no single persisted cost rule can be demonstrated
- **THEN** implementation SHALL stop before exposing a guessed cost total

### Requirement: Inventory dashboard is operational
The inventory screen SHALL use compact context, real filters, primary and secondary indicators, critical products, compact trends, recent purchases and pending orders, with explicit loading, empty, null and error states.

#### Scenario: Critical products have no rows
- **WHEN** `tables.criticalProducts` is empty or null
- **THEN** the screen shows a readable empty state and no illustrative rows

### Requirement: Purchase receiving records supplier invoice
The real purchase receiving flow SHALL require and persist the supplier invoice number at receipt, preserve existing supplier and payment data, and persist it atomically with the receipt. Supplier invoice date SHALL be captured only when supported by the existing model or an explicitly justified additive field.

#### Scenario: Receipt succeeds
- **WHEN** a valid receiving request includes the required supplier invoice number
- **THEN** the receipt and invoice number are committed together and can be retrieved from the same purchase/receipt

#### Scenario: Receipt fails
- **WHEN** any part of receiving fails
- **THEN** inventory movement and supplier invoice data are both rolled back

### Requirement: POS report loads today's sales
The POS report SHALL initially use the existing date and locality rules for the current day, show compact filters and summary values for sales, total, paid and balance, use the existing pagination, and keep the download action beside filters.

#### Scenario: Initial report load
- **WHEN** the POS report opens
- **THEN** it requests the current day's sales using the established scope and renders existing pagination

### Requirement: Electronic document action requires DIAN acceptance
The report SHALL enable an electronic ticket/document action only when the sale has the contractual accepted-DIAN state. Pending, processing, sending, rejected, error and non-accepted states SHALL disable that action, while an independent conventional POS ticket action remains available.

#### Scenario: Sale is accepted by DIAN
- **WHEN** the sale status equals the domain's accepted-DIAN enum
- **THEN** the electronic document action is enabled

#### Scenario: Sale is not accepted
- **WHEN** the sale status is any non-accepted state
- **THEN** the electronic document action is disabled

### Requirement: Approved responsive UX states
Each affected screen SHALL keep compact controls, readable tables, touch-safe actions, internal modal scroll, and accessible drawer/footer actions across mobile, 1280px and desktop widths.

#### Scenario: Customer modal on mobile
- **WHEN** the customer modal opens on a mobile viewport
- **THEN** it can use nearly the full viewport while keeping search, scrollable results, selection highlight and cancel/confirm actions visible
