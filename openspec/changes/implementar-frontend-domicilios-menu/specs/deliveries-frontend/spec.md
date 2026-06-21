## ADDED Requirements

### Requirement: Delivery frontend route
The system SHALL provide a tenant-scoped Domicilios page at `/{tenant}/deliveries`.

#### Scenario: Authorized user opens deliveries page
- **WHEN** an authenticated authorized user navigates to `/{tenant}/deliveries`
- **THEN** the system shows the Domicilios operational screen using the tenant layout

#### Scenario: Route permission is enforced
- **WHEN** route permissions are loaded for a user without delivery read access
- **THEN** the system blocks the Domicilios route using the existing frontend permission guard

### Requirement: Delivery list
The system SHALL list delivery records returned by `GET /api/deliveries`.

#### Scenario: Delivery rows show operational data
- **WHEN** delivery records are loaded
- **THEN** each row shows status, contact, phone, address, related order when present, related sale when present, assigned courier when present, creation date, lifecycle date when present, delivery fee when present and available actions

#### Scenario: Empty state is visible
- **WHEN** no deliveries match the current query
- **THEN** the system shows a clear empty state instead of an empty table

### Requirement: Delivery filters
The system SHALL expose only real backend filters plus clearly scoped local filtering.

#### Scenario: Backend filters are applied
- **WHEN** the user filters by status, order id, sale id, date from or date to
- **THEN** the system sends supported query parameters to `GET /api/deliveries`

#### Scenario: Text search is local only
- **WHEN** the user searches by contact, phone or address
- **THEN** the system filters the currently loaded rows locally and documents backend global search as pending

#### Scenario: Filters can be reset
- **WHEN** the user clicks clear filters
- **THEN** the system resets filters to defaults and can reload the first page

### Requirement: Delivery detail
The system SHALL show an operational detail panel for a selected delivery.

#### Scenario: Detail loads from backend
- **WHEN** the user opens a delivery detail
- **THEN** the system calls `GET /api/deliveries/:id` and shows id, delivery number, status, contact, address, order, sale, courier, dates, reasons or notes when available and financial source fields only as information

#### Scenario: Missing history is documented
- **WHEN** the backend response does not include status history
- **THEN** the detail view shows the available timestamps and documents status history as pending

### Requirement: Delivery creation
The system SHALL provide a basic manual delivery creation flow when the user has create permission.

#### Scenario: Manual delivery is created
- **WHEN** the user submits required contact/address fields and optional order or sale references
- **THEN** the system calls `POST /api/deliveries` and refreshes the list on success

#### Scenario: Creation error is shown
- **WHEN** the backend rejects creation
- **THEN** the system shows the backend error message or a clear fallback error

### Requirement: Delivery actions by state
The system SHALL show delivery state actions only when allowed by current state and frontend permission.

#### Scenario: Created delivery actions
- **WHEN** a delivery status is `CREATED`
- **THEN** the system offers assign and cancel when permissions allow them

#### Scenario: Assigned delivery actions
- **WHEN** a delivery status is `ASSIGNED`
- **THEN** the system offers dispatch and cancel when permissions allow them

#### Scenario: Dispatched delivery actions
- **WHEN** a delivery status is `DISPATCHED`
- **THEN** the system offers mark delivered and mark not delivered when permissions allow them

#### Scenario: Final states have no operational actions
- **WHEN** a delivery status is `DELIVERED`, `NOT_DELIVERED` or `CANCELLED`
- **THEN** the system shows no operational state-change actions

#### Scenario: Sensitive action requests confirmation or reason
- **WHEN** the user cancels, marks not delivered or marks delivered
- **THEN** the system asks for confirmation or required reason before calling the backend

### Requirement: Delivery menu access
The system SHALL register the Domicilios route with frontend menu/permission constants without modifying SQL.

#### Scenario: Backend menu contains deliveries
- **WHEN** `/me/menu` returns a visible `DELIVERIES` item
- **THEN** the sidebar can render a Domicilios link to `/{tenant}/deliveries`

#### Scenario: Backend menu does not contain deliveries
- **WHEN** `/me/menu` does not return a visible `DELIVERIES` item
- **THEN** the frontend does not fabricate a sidebar item and documents menu seed as pending

### Requirement: Delivery responsive UX
The system SHALL keep the Domicilios screen usable on desktop and mobile.

#### Scenario: Mobile filters are usable
- **WHEN** the screen is viewed on a narrow viewport
- **THEN** filters stack vertically and action buttons remain tappable

#### Scenario: No global horizontal overflow
- **WHEN** the screen is viewed on mobile
- **THEN** the page avoids global horizontal overflow and uses contained scrolling only where needed

### Requirement: Delivery frontend excludes caja POS and electronic invoicing
The system SHALL not change caja, POS, financial movements, electronic invoicing or SQL in this frontend phase.

#### Scenario: Delivery state action succeeds
- **WHEN** a delivery state action completes
- **THEN** the frontend refreshes delivery data only and does not create cash movements, POS changes, electronic invoicing changes or SQL changes

### Requirement: Order delivery visual relation
The system SHALL let users inspect and create a delivery associated with an order from the orders UI without changing the order flow.

#### Scenario: Order has an associated delivery
- **WHEN** the user opens the Domicilio action for an order with an associated delivery
- **THEN** the system shows the delivery status, contact, address, a detail action and a link to `/{tenant}/deliveries?order_id={orderId}`

#### Scenario: Order has no associated delivery
- **WHEN** the user opens the Domicilio action for an order without a delivery
- **THEN** the system shows a clear empty state and a create action when `DELIVERIES_CREATE` is allowed

#### Scenario: Delivery is created from an order
- **WHEN** the user submits the minimum delivery fields from an order
- **THEN** the system calls `POST /api/orders/:id/delivery`, refreshes the relation view and does not modify order creation, invoicing, payment, caja, POS, totals or taxes

### Requirement: Sale delivery visual relation
The system SHALL let users inspect and create a delivery associated with a sale from the available sales UI without changing POS, caja, totals, taxes or electronic invoicing.

#### Scenario: Sale has an associated delivery
- **WHEN** the user opens the Domicilio action for a sale with an associated delivery
- **THEN** the system shows the delivery status, contact, address, financial source when available, a detail action and a link to `/{tenant}/deliveries?sale_id={saleId}`

#### Scenario: Sale has no associated delivery
- **WHEN** the user opens the Domicilio action for a sale without a delivery
- **THEN** the system shows a clear empty state and a create action when `DELIVERIES_CREATE` is allowed

#### Scenario: Delivery is created from a sale
- **WHEN** the user submits the minimum delivery fields from a sale
- **THEN** the system calls `POST /api/sales/:id/delivery` with only allowed financial sources `INVOICE_INCLUDED` or `NO_FEE`, refreshes the relation view and does not modify POS, caja, totals, taxes or electronic invoicing

### Requirement: Delivery module relation filters
The system SHALL initialize Domicilios filters from supported order and sale query params.

#### Scenario: Order filtered module link is opened
- **WHEN** the user navigates to `/{tenant}/deliveries?order_id={orderId}`
- **THEN** the Domicilios screen initializes the `order_id` filter and loads matching deliveries

#### Scenario: Sale filtered module link is opened
- **WHEN** the user navigates to `/{tenant}/deliveries?sale_id={saleId}`
- **THEN** the Domicilios screen initializes the `sale_id` filter and loads matching deliveries
