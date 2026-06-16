## ADDED Requirements

### Requirement: Cash close counted amount accepts decimal money
The cash session close form SHALL allow the operator to enter counted cash as a monetary value with up to two decimals while keeping the API payload numeric.

#### Scenario: Counted amount zero
- **WHEN** the operator enters `$0`
- **THEN** the form SHALL accept the value
- **AND** the close payload SHALL send `closingAmount` as numeric `0`.

#### Scenario: Counted amount integer
- **WHEN** the operator enters `$1000`
- **THEN** the form SHALL accept the value
- **AND** the close payload SHALL send `closingAmount` as numeric `1000`.

#### Scenario: Counted amount decimal
- **WHEN** the operator enters `$1000.50` or `$123456.75`
- **THEN** the form SHALL accept the value with up to two decimals
- **AND** the close payload SHALL send a number without the `$` symbol.

#### Scenario: Invalid formatted value
- **WHEN** the operator types currency symbols, spaces, separators, or extra decimals
- **THEN** the UI SHALL sanitize the display value
- **AND** SHALL NOT send `NaN`, `undefined`, `null`, negative values, or formatted strings to the API.

### Requirement: Operational inventory actions are available to authorized admin roles
Operational inventory views SHALL expose complete actions to `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` while keeping `USER` blocked from administrative writes.

#### Scenario: ADMIN manages inventory locations and lots
- **WHEN** an `ADMIN` works in `/inventory/locations` or `/inventory/lots`
- **THEN** create, update, deactivate, block, or cancel actions supported by the view and API SHALL be authorized within current tenant and branch scope.

#### Scenario: ADMIN manages products including stock adjustment
- **WHEN** an `ADMIN` works in `/inventory/products`
- **THEN** product management actions including stock adjustment SHALL be available within current tenant and branch scope.

#### Scenario: ADMIN manages promotions
- **WHEN** an `ADMIN` works in `/inventory/promotions`
- **THEN** promotion actions SHALL remain available according to the current promotions permission model.

#### Scenario: USER remains blocked
- **WHEN** a `USER` tries administrative inventory write actions
- **THEN** the UI and API SHALL NOT grant the new administrative access.

### Requirement: Terminal configuration remains scoped to super roles
Terminal configuration SHALL remain available to `SUPER_USER` and `SUPER_ADMIN` only.

#### Scenario: SUPER_USER manages terminals
- **WHEN** a `SUPER_USER` works in `/config/terminals`
- **THEN** terminal actions SHALL remain available within tenant scope.
- **AND** the route SHALL require the `CONFIG_TERMINALS` menu permission.

#### Scenario: ADMIN cannot manage terminals
- **WHEN** an `ADMIN` attempts `/config/terminals`
- **THEN** terminal management SHALL remain blocked.

#### Scenario: Legacy terminales path
- **WHEN** a user reaches `/{tenant}/terminales`
- **THEN** the web app SHALL redirect to the canonical `/{tenant}/config/terminals` route.
- **AND** the canonical route SHALL enforce the same `CONFIG_TERMINALS` permission.

### Requirement: Sidebar exposes authorized operational modules
The sidebar/navigation SHALL render authorized operational routes from the dynamic menu stored in database and returned by `/me/menu`, without replacing that catalog with local frontend shortcuts, duplicating routes, or exposing administrative modules to `USER`.

#### Scenario: ADMIN inventory menu
- **WHEN** an `ADMIN` opens the sidebar
- **THEN** inventory menu entries for `Productos`, `Unidades`, `Impuestos`, `Promociones`, `Ubicaciones`, and `Lotes` SHALL be visible.
- **AND** `Terminales` SHALL NOT be visible.

#### Scenario: SUPER_USER inventory and terminals menu
- **WHEN** a `SUPER_USER` opens the sidebar
- **THEN** inventory menu entries for `Productos`, `Unidades`, `Impuestos`, `Promociones`, `Ubicaciones`, and `Lotes` SHALL be visible.
- **AND** `Terminales` SHALL be visible under configuration/navigation scope.

#### Scenario: SUPER_ADMIN inventory and terminals menu
- **WHEN** a `SUPER_ADMIN` opens the sidebar
- **THEN** inventory menu entries for `Productos`, `Unidades`, `Impuestos`, `Promociones`, `Ubicaciones`, and `Lotes` SHALL be visible.
- **AND** `Terminales` SHALL be visible under configuration/navigation scope.

#### Scenario: USER menu remains restricted
- **WHEN** a `USER` opens the sidebar
- **THEN** administrative inventory entries and terminal configuration SHALL NOT be exposed by this change.

#### Scenario: Dynamic menu is source of truth
- **WHEN** `/me/menu` returns authorized menu items and children from `menu_items` and `role_menu_permissions`
- **THEN** the frontend SHALL preserve the returned tree and only filter by the active permission list.
- **AND** local fallback logic SHALL NOT replace, reduce, or duplicate valid database menu entries.
