## ADDED Requirements

### Requirement: Delivery permission actions
The system SHALL define future delivery permissions for viewing, creating, updating, assigning, dispatching, marking delivered, marking not delivered, cancelling and reporting deliveries.

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

#### Scenario: Not-delivered permission is required
- **WHEN** a user moves a delivery to `NO_ENTREGADO`
- **THEN** the user must have `DELIVERIES_MARK_NOT_DELIVERED`

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

### Requirement: Delivery role permission matrix proposal
The system SHALL document a future role matrix for `DELIVERIES_*` permissions without applying real permission records.

#### Scenario: USER operational matrix is reviewed
- **WHEN** USER permissions are reviewed
- **THEN** USER can be proposed for view, create and basic pre-dispatch update, while dispatch, delivered and not-delivered actions remain explicit business decisions

#### Scenario: ADMIN operational matrix is reviewed
- **WHEN** ADMIN permissions are reviewed
- **THEN** ADMIN can be proposed for view, create, update, assign, dispatch, mark delivered, mark not delivered, cancel and reports within authorized scope

#### Scenario: SUPER_USER matrix is reviewed
- **WHEN** SUPER_USER permissions are reviewed
- **THEN** SUPER_USER can be proposed for ADMIN-equivalent delivery permissions within the authenticated tenant plus operational audit visibility

#### Scenario: SUPER_ADMIN matrix is reviewed
- **WHEN** SUPER_ADMIN permissions are reviewed
- **THEN** SUPER_ADMIN can be proposed for all delivery permissions with global behavior constrained by existing multi-tenant rules

### Requirement: Permissions are not applied in this phase
The system SHALL NOT modify `menu_items`, `role_menu_permissions`, frontend route permissions, backend decorators or guard logic during this OpenSpec-only phase.

#### Scenario: Permission design is validated
- **WHEN** this change is validated
- **THEN** proposed delivery permissions remain documentation-only and no real access matrix is changed

### Requirement: Backend permission implementation plan
The system SHALL document future backend permission rollout without modifying guards, menus or seeds in this phase.

#### Scenario: Endpoint permission mapping is planned
- **WHEN** future `DeliveriesController` endpoints are reviewed
- **THEN** each endpoint has a documented `DELIVERIES_*` permission requirement before implementation

#### Scenario: Role matrix rollout is planned
- **WHEN** future permission SQL is prepared
- **THEN** it must be idempotent and reviewed separately before applying `DELIVERIES_*` to real roles

#### Scenario: Guard changes are deferred
- **WHEN** this backend planning phase is completed
- **THEN** no real guard, decorator, menu, route permission or seed file is modified
