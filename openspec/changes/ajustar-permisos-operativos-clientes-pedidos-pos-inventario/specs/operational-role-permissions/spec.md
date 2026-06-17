## ADDED Requirements

### Requirement: Operational customer writes
The system SHALL allow `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` to create and edit customers when authenticated inside the active tenant.

#### Scenario: USER creates or edits a customer
- **WHEN** a `USER` calls the customer create or update flow from Customers, Orders, or POS
- **THEN** the backend SHALL authorize the operation inside the authenticated tenant.
- **AND** the frontend SHALL expose the create/edit customer actions.

#### Scenario: Admin roles create or edit a customer
- **WHEN** `ADMIN`, `SUPER_USER`, or `SUPER_ADMIN` creates or edits a customer
- **THEN** the backend and frontend SHALL allow the operation according to tenant scope.

### Requirement: Fiscal customer endpoints used by Customers
The system SHALL allow `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` to use the fiscal customer endpoints required by the `/customers` screen for basic customer list/create/edit workflows.

#### Scenario: USER loads fiscal customer data
- **WHEN** a `USER` opens `/customers`
- **THEN** `GET /api/electronic-invoicing/customers` SHALL be authorized inside the authenticated tenant.

#### Scenario: USER edits fiscal customer data
- **WHEN** a `USER` saves an edit from `/customers`
- **THEN** `PATCH /api/electronic-invoicing/customers/:id` SHALL be authorized inside the authenticated tenant.

#### Scenario: Operational roles create fiscal customer data
- **WHEN** `USER`, `ADMIN`, or `SUPER_USER` creates a customer from `/customers`
- **THEN** `POST /api/electronic-invoicing/customers` SHALL be authorized.
- **AND** fiscal customer permissions SHALL NOT grant access to unrelated electronic-invoicing supplier or document administration endpoints.

### Requirement: Operational catalog reads for POS and Orders
The system SHALL allow `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` to read customers, products, and taxes required by POS and Orders without requiring administrative inventory visibility.

#### Scenario: USER loads POS dependencies
- **WHEN** a `USER` opens POS
- **THEN** product catalog requests for the active branch SHALL be authorized.
- **AND** tax catalog requests SHALL be authorized.

#### Scenario: USER loads Orders dependencies
- **WHEN** a `USER` opens Orders
- **THEN** customer and product selectors SHALL load from authorized backend reads.
- **AND** any required tax reads SHALL be authorized.

### Requirement: Operational pricing preview for POS and Orders
The system SHALL allow `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` to calculate line price and promotion previews required by POS and Orders without granting pricing or promotion administration.

#### Scenario: USER adds product to POS cart
- **WHEN** a `USER` adds a product in POS and the frontend calls `POST /api/pricing/preview-line`
- **THEN** the backend SHALL authorize the request inside the authenticated tenant.
- **AND** the response SHALL still be calculated by the pricing service using the provided branch, product, quantity, channel, and customer context.

#### Scenario: Promotion administration remains protected
- **WHEN** a `USER` calls pricing promotion administration endpoints
- **THEN** the backend SHALL deny create, update, deactivate, or other administrative promotion writes.

### Requirement: USER inventory administration remains blocked
The system SHALL prevent `USER` from seeing or accessing administrative Inventory modules while preserving operational reads used by POS and Orders.

#### Scenario: USER menu excludes Inventory
- **WHEN** `/me/menu` and frontend menu filtering build navigation for `USER`
- **THEN** `INVENTORY` and administrative `INVENTORY_*` entries SHALL NOT be visible.

#### Scenario: USER direct inventory route is blocked
- **WHEN** a `USER` directly enters `/inventory` or an administrative Inventory subroute
- **THEN** the frontend route permission check SHALL block the route or show unauthorized state.

#### Scenario: USER inventory writes remain denied
- **WHEN** a `USER` attempts to create, update, delete, adjust, block, receive, or otherwise manage administrative inventory data
- **THEN** the backend SHALL deny the administrative write.

### Requirement: Protected administration boundaries remain unchanged
The system SHALL preserve existing protected boundaries for Roles, Terminales, Finanzas, and super roles while fixing operational permissions.

#### Scenario: Roles remain SUPER_ADMIN only
- **WHEN** `USER`, `ADMIN`, or `SUPER_USER` navigates to Roles or calls role management endpoints
- **THEN** access SHALL remain denied.

#### Scenario: Terminales remain super-role scoped
- **WHEN** `USER` or `ADMIN` navigates to Terminales or calls terminal management endpoints
- **THEN** access SHALL remain denied.
- **AND** `SUPER_USER` and `SUPER_ADMIN` SHALL remain authorized.

#### Scenario: Finanzas remains visible to authorized operational roles
- **WHEN** `USER` or `ADMIN` has configured Finanzas access
- **THEN** the frontend SHALL NOT hide Finanzas as part of this Inventory fix.

### Requirement: Idempotent permission SQL
The system SHALL provide idempotent SQL that aligns configured menu permissions for the operational tenant without broad global grants.

#### Scenario: USER inventory permissions are broader than expected
- **WHEN** the SQL runs for tenant `00000000-0000-0000-0000-000000000001`
- **THEN** administrative `INVENTORY` and `INVENTORY_*` menu permissions for `USER` SHALL be removed or disabled.
- **AND** duplicate `menu_items` or `role_menu_permissions` SHALL NOT be created.

#### Scenario: SQL is applied twice
- **WHEN** the SQL is executed twice against the same local database
- **THEN** the second execution SHALL succeed without changing the intended final permission matrix.
