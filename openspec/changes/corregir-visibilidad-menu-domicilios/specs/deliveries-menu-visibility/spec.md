## ADDED Requirements

### Requirement: Deliveries menu visibility
The system SHALL show the Domicilios menu item to authorized roles when the `DELIVERIES` menu item is configured, visible and permitted.

#### Scenario: Authorized role sees Domicilios in the sidebar
- **WHEN** an authenticated user has a role menu permission for `DELIVERIES` and the configured `DELIVERIES` menu item is visible
- **THEN** the sidebar shows `Domicilios`

#### Scenario: Unauthorized role does not see Domicilios
- **WHEN** an authenticated user lacks a role menu permission for `DELIVERIES`
- **THEN** the sidebar does not show `Domicilios`

#### Scenario: Domicilios route uses current tenant path
- **WHEN** the sidebar renders the `DELIVERIES` menu item
- **THEN** the item route resolves from `/{tenant}/deliveries` to the authenticated tenant path

#### Scenario: Menu rendering avoids hardcoded tenant ids
- **WHEN** the tenant changes for an authenticated session
- **THEN** the Domicilios route uses the active tenant id and does not hardcode a tenant id

### Requirement: Deliveries menu permission consistency
The system SHALL use role menu permissions consistently for the Domicilios module.

#### Scenario: DELIVERIES menu item returned when role has access
- **WHEN** `/api/me/menu` is requested by a user whose role has access to `DELIVERIES`
- **THEN** the response includes the visible `DELIVERIES` menu item

#### Scenario: DELIVERIES menu item filtered when role lacks access
- **WHEN** `/api/me/menu` is requested by a user whose role lacks access to `DELIVERIES`
- **THEN** the response excludes the `DELIVERIES` menu item

#### Scenario: Existing modules keep current visibility
- **WHEN** the Domicilios visibility fix is applied
- **THEN** existing modules such as Customers, Finance, Orders, POS and Inventory keep their current visibility behavior
