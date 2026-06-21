## ADDED Requirements

### Requirement: Delivery permission actions
The system SHALL define future delivery permissions for viewing, creating, updating, assigning, dispatching, marking delivered, cancelling and reporting deliveries.

#### Scenario: View permission is required
- **WHEN** a user opens the future delivery list or detail
- **THEN** the user must have `DELIVERIES_VIEW` or an equivalent menu/action permission

#### Scenario: Create permission is required
- **WHEN** a user creates a manual delivery or creates one from an order/invoice
- **THEN** the user must have `DELIVERIES_CREATE`

#### Scenario: Assignment permission is required
- **WHEN** a user assigns or changes the responsible user or courier
- **THEN** the user must have `DELIVERIES_ASSIGN`

#### Scenario: Dispatch permission is required
- **WHEN** a user moves a delivery to `DESPACHADO`
- **THEN** the user must have `DELIVERIES_DISPATCH`

#### Scenario: Delivery completion permission is required
- **WHEN** a user moves a delivery to `ENTREGADO`
- **THEN** the user must have `DELIVERIES_MARK_DELIVERED`

#### Scenario: Cancel permission is required
- **WHEN** a user moves a delivery to `CANCELADO`
- **THEN** the user must have `DELIVERIES_CANCEL`

#### Scenario: Reports permission is required
- **WHEN** a user opens future delivery reports
- **THEN** the user must have `DELIVERIES_REPORTS`

### Requirement: Initial role access proposal
The system SHALL document an initial role access proposal without applying it to real permission data in this phase.

#### Scenario: SUPER_ADMIN access proposal
- **WHEN** `SUPER_ADMIN` uses the future Domicilios module
- **THEN** the proposed access includes all `DELIVERIES_*` permissions with global tenant administration rules

#### Scenario: SUPER_USER access proposal
- **WHEN** `SUPER_USER` uses the future Domicilios module
- **THEN** the proposed access includes operational and reporting permissions within the authenticated tenant

#### Scenario: ADMIN access proposal
- **WHEN** `ADMIN` uses the future Domicilios module
- **THEN** the proposed access includes view, create, update, assign, dispatch, mark delivered, cancel and reports within authorized branch scope

#### Scenario: USER access proposal
- **WHEN** `USER` uses the future Domicilios module
- **THEN** the proposed access is limited to view, create and operational update actions within authorized tenant, branch and cash context unless a later decision grants more

### Requirement: Permissions are not applied in this phase
The system SHALL NOT modify `menu_items`, `role_menu_permissions`, frontend route permissions, backend decorators or guard logic during this OpenSpec-only phase.

#### Scenario: Permission design is validated
- **WHEN** this change is validated
- **THEN** proposed delivery permissions remain documentation-only and no real access matrix is changed
