# deliveries-permissions Specification

## Purpose
TBD - created by archiving change gestionar-domicilios-clientes-pedidos-facturacion-caja. Update Purpose after archive.
## Requirements
### Requirement: Delivery permission actions
The system SHALL define and enforce backend delivery permissions for viewing, creating, updating, assigning, dispatching, marking delivered, marking not delivered, cancelling and reporting deliveries.

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
- **WHEN** a user moves a delivery to `DISPATCHED`
- **THEN** the user must have `DELIVERIES_DISPATCH`

#### Scenario: Delivery completion permission is required
- **WHEN** a user moves a delivery to `DELIVERED`
- **THEN** the user must have `DELIVERIES_MARK_DELIVERED`

#### Scenario: Not-delivered permission is required
- **WHEN** a user moves a delivery to `NOT_DELIVERED`
- **THEN** the user must have `DELIVERIES_MARK_NOT_DELIVERED`

#### Scenario: Cancel permission is required
- **WHEN** a user moves a delivery to `CANCELLED`
- **THEN** the user must have `DELIVERIES_CANCEL`

#### Scenario: Reports permission is required
- **WHEN** a user opens future delivery reports
- **THEN** the user must have `DELIVERIES_REPORTS`

### Requirement: Initial role access proposal
The system SHALL document an initial role access proposal and SHALL use it for the Fase 6A local/QA permission SQL.

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
The system SHALL document a role matrix for `DELIVERIES_*` permissions and SHALL keep production application gated by explicit approval.

#### Scenario: USER operational matrix is reviewed
- **WHEN** USER permissions are reviewed
- **THEN** USER can be proposed for view, create, basic update, dispatch, delivered and not-delivered actions, while assignment, cancellation and reports remain restricted

#### Scenario: ADMIN operational matrix is reviewed
- **WHEN** ADMIN permissions are reviewed
- **THEN** ADMIN can be proposed for view, create, update, assign, dispatch, mark delivered, mark not delivered, cancel and reports within authorized scope

#### Scenario: SUPER_USER matrix is reviewed
- **WHEN** SUPER_USER permissions are reviewed
- **THEN** SUPER_USER can be proposed for ADMIN-equivalent delivery permissions within the authenticated tenant plus operational audit visibility

#### Scenario: SUPER_ADMIN matrix is reviewed
- **WHEN** SUPER_ADMIN permissions are reviewed
- **THEN** SUPER_ADMIN can be proposed for all delivery permissions with global behavior constrained by existing multi-tenant rules

### Requirement: Delivery permissions are not applied in Fase 4
The system SHALL NOT modify `menu_items`, `role_menu_permissions`, frontend route permissions or permission seed data during Fase 4.

#### Scenario: Permission design is validated
- **WHEN** this change is validated
- **THEN** proposed delivery permissions remain documentation-only and no real access matrix is changed

#### Scenario: Initial runtime uses existing authentication
- **WHEN** Fase 4 and Fase 5 delivery endpoints are implemented before real delivery permission seeds exist
- **THEN** they use `JwtAuthGuard` and defer `DELIVERIES_*` enforcement until real menu/action permissions are seeded in a later phase

### Requirement: Backend permission implementation plan
The system SHALL document backend permission rollout before applying runtime permission enforcement.

#### Scenario: Endpoint permission mapping is planned
- **WHEN** future `DeliveriesController` endpoints are reviewed
- **THEN** each endpoint has a documented `DELIVERIES_*` permission requirement before implementation

#### Scenario: Role matrix rollout is planned
- **WHEN** future permission SQL is prepared
- **THEN** it must be idempotent and reviewed separately before applying `DELIVERIES_*` to real roles

#### Scenario: Permission guard rollout is deferred before Fase 6A
- **WHEN** the backend planning phase is completed before Fase 6A
- **THEN** no menu, route permission or seed file is modified for `DELIVERIES_*` until a dedicated permission phase is approved

### Requirement: Delivery backend permissions are enforced in Fase 6A
The system SHALL protect delivery backend endpoints with the existing `PermissionsGuard`, `MENU_KEYS.DELIVERIES` and explicit `DELIVERIES_*` action permissions.

#### Scenario: CRUD endpoints require delivery permissions
- **WHEN** Fase 6A is implemented
- **THEN** list and detail require `DELIVERIES_VIEW`, create requires `DELIVERIES_CREATE`, and patch requires `DELIVERIES_UPDATE`

#### Scenario: State endpoints require action permissions
- **WHEN** Fase 6A is implemented
- **THEN** assign, dispatch, mark-delivered, mark-not-delivered and cancel require `DELIVERIES_ASSIGN`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_MARK_NOT_DELIVERED` and `DELIVERIES_CANCEL`

#### Scenario: Summary report endpoint is permission gated
- **WHEN** Fase 6A is implemented
- **THEN** `GET /api/deliveries/reports/summary` requires `DELIVERIES_REPORTS` but advanced report logic remains deferred

#### Scenario: Missing permission is rejected
- **WHEN** an authenticated actor calls a delivery endpoint without the required `DELIVERIES_*` action in `role_menu_permissions.actions`
- **THEN** the backend rejects the request through the existing permission model

#### Scenario: Local QA permission SQL is generated
- **WHEN** Fase 6A is implemented
- **THEN** an idempotent local/QA SQL file prepares `DELIVERIES` menu data and role action matrix without applying it automatically to production

