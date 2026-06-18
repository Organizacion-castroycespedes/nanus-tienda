## ADDED Requirements

### Requirement: Version 0.0.1 closure documentation
The release closure SHALL document the current Manus POS system state for version `0.0.1` without modifying business logic, permissions, API contracts, production, or SQL.

#### Scenario: Release documents exist
- **WHEN** the change is reviewed
- **THEN** the repository contains release documents under `docs/release/`
- **AND** those documents cover system state, module inventory, QA, permissions, backlog, risks, blockers and closure criteria

#### Scenario: No functional implementation is included
- **WHEN** the change diff is reviewed
- **THEN** only documentation and OpenSpec artifacts are changed
- **AND** no `api/`, `web/`, runtime service, SQL migration or seed behavior is modified

### Requirement: Module state classification
The release closure SHALL classify each in-scope module with one of `COMPLETO`, `FUNCIONAL_CON_OBSERVACIONES`, `PARCIAL`, `PENDIENTE`, or `BLOQUEADO_EXTERNO`.

#### Scenario: Developed modules are classified
- **WHEN** the inventory is reviewed
- **THEN** POS, Orders, Caja/Finanzas, Inventario, Compras, Clientes, Proveedores, Promociones/Pricing, Impuestos, Reportes, Seguridad/RBAC and Multitenant/Branding/Configuracion have explicit states

#### Scenario: Pending or blocked modules are classified
- **WHEN** the inventory is reviewed
- **THEN** Capacitor, Electron, physical peripherals, electronic invoicing, CRM and Home/Dashboard/Product UX have explicit states
- **AND** external blockers are separated from technical blockers

### Requirement: QA and validation evidence
The release closure SHALL include a QA matrix and final validation results for the change.

#### Scenario: QA matrix is present
- **WHEN** QA state is reviewed
- **THEN** historical evidence and command validations are traceable
- **AND** PASS/FAIL/BLOCKED status is visible

#### Scenario: Final validations are run
- **WHEN** the closure work finishes
- **THEN** OpenSpec validation, applicable builds/tests/lint, `git diff --check`, and `git status --short` are executed or explicitly reported as not applicable/failing

### Requirement: Permission matrix
The release closure SHALL include a role permission matrix for `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, and `USER`.

#### Scenario: Role capabilities are documented
- **WHEN** the permission matrix is reviewed
- **THEN** each major module shows role-level access and notable restrictions
- **AND** the matrix identifies drift risk when database seeds or migrations are missing

### Requirement: Post-release roadmap boundaries
The release closure SHALL document what can proceed after `v0.0.1`, what depends on external purchases or certificates, and what must not enter `v0.0.1`.

#### Scenario: Roadmap is separated from release scope
- **WHEN** roadmap documentation is reviewed
- **THEN** follow-up work is listed as post-v0.0.1
- **AND** hardware, DIAN real, Electron, Capacitor, CRM expansion and new product UX are not included in the sealed release
