# access-role-audit Specification

## Purpose
TBD - created by archiving change auditoria-accesos-roles. Update Purpose after archive.
## Requirements
### Requirement: Role and User Inventory
The system SHALL provide a formal audit inventory of all roles and users associated with each role.

#### Scenario: Roles are inventoried from runtime or repository sources
- **WHEN** the audit runs against an available database
- **THEN** it SHALL list every role from `roles` with id, name, description and source tenant relationships where available.
- **AND** it SHALL include seeded roles from SQL files as supporting evidence.

#### Scenario: Users are grouped by role
- **WHEN** the audit reads `users`, `user_roles`, tenants, branches and related persona data
- **THEN** it SHALL group users by role and include tenant, branch, status and identifiers needed for traceability.

#### Scenario: Runtime database is unavailable
- **WHEN** the audit cannot connect to a runtime database
- **THEN** it SHALL mark runtime user-role evidence as unavailable.
- **AND** it SHALL continue with repository SQL seeds and migrations as expected configuration evidence.

### Requirement: Module and Menu Inventory
The system SHALL provide an inventory of modules, menu items and menu permissions configured per role.

#### Scenario: Menu items are inventoried
- **WHEN** the audit reads `menu_items` or menu seed SQL
- **THEN** it SHALL list key, module, label, route, visibility, parent-child relation, tenant scope and deletion status.

#### Scenario: Role menu permissions are inventoried
- **WHEN** the audit reads `role_menu_permissions`
- **THEN** it SHALL list each role-menu access level as `READ` or `WRITE`.
- **AND** it SHALL include action permissions from the `actions` JSON payload when present.

#### Scenario: Legacy permissions are present
- **WHEN** legacy `permissions` rows or seed files are found
- **THEN** the audit SHALL compare them against `menu_items` and `role_menu_permissions`.
- **AND** it SHALL flag legacy-only or menu-only differences.

### Requirement: Frontend Route Access Matrix
The system SHALL provide a route access matrix for every frontend page under `web/app`.

#### Scenario: Tenant pages are mapped to permission rules
- **WHEN** the audit scans tenant routes such as `/[tenant]/dashboard`, `/[tenant]/usuarios`, `/[tenant]/inventory/*`, `/[tenant]/finance/*` and `/[tenant]/reporteria/*`
- **THEN** it SHALL record the route, page file, required menu/module/action, and protection mechanism.

#### Scenario: Route has no explicit permission requirement
- **WHEN** a route is not covered by `web/lib/route-permissions.ts` or a page-level/domain-level permission helper
- **THEN** the audit SHALL flag the route as frontend-unmapped.
- **AND** it SHALL classify whether the route is intentionally public, login-only, tenant-layout protected, or potentially exposed.

#### Scenario: Frontend role shortcuts are found
- **WHEN** frontend code grants access by direct role checks
- **THEN** the audit SHALL document the role shortcut and compare it with backend behavior for equivalent actions.

### Requirement: Backend Endpoint Access Matrix
The system SHALL provide an endpoint access matrix for the main API and reporting API.

#### Scenario: Main API endpoints are mapped
- **WHEN** the audit scans NestJS controllers under `api/src/modules`
- **THEN** it SHALL list controller path, HTTP method, route path, guards, `@Roles`, `@RequirePermission`, permission level, action and source file.

#### Scenario: Reporting API endpoints are mapped
- **WHEN** the audit scans controllers under `backend-reporteria/src/modules`
- **THEN** it SHALL list report endpoints, JWT/mock auth behavior, authorization guards and role handling.

#### Scenario: Endpoint lacks role or permission guard
- **WHEN** an endpoint has no `RolesGuard`, `PermissionsGuard`, domain authz guard or documented public intent
- **THEN** the audit SHALL flag it as an access-control review item.

### Requirement: Effective Permission Matrix
The system SHALL calculate and document effective access by role for modules, menus, frontend routes and backend endpoints.

#### Scenario: Backend effective access is calculated
- **WHEN** an endpoint has role guards and permission guards
- **THEN** the audit SHALL combine required roles, required menu permission, access level, action permission and service-level constraints into the backend effective access result.

#### Scenario: Super role bypasses are applied
- **WHEN** code grants special access to `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` or another role
- **THEN** the audit SHALL show the bypass source and the resulting access separately from DB-configured permissions.

#### Scenario: Frontend visible access differs from backend access
- **WHEN** a role can see a route/menu but the backend denies the endpoint, or the backend allows an endpoint hidden by the UI
- **THEN** the audit SHALL record the discrepancy with affected role, route, endpoint and evidence.

### Requirement: DB Versus Code Discrepancy Report
The system SHALL report differences between database configuration and authorization logic in code.

#### Scenario: Menu key mismatch is found
- **WHEN** a menu key exists in backend constants, frontend constants, DB, seeds or decorators but not in all required places
- **THEN** the audit SHALL flag the mismatch with source locations and affected modules.

#### Scenario: Role capability differs by layer
- **WHEN** frontend helpers, backend guards, service checks or DB permissions grant different access for the same role/module
- **THEN** the audit SHALL document the difference as configured-only, frontend-only, backend-only or service-only.

#### Scenario: Public or mock access is found
- **WHEN** public endpoints or mock authentication modes are detected
- **THEN** the audit SHALL classify the expected environment impact for DEV, QA and PRD.

### Requirement: Security Risk and Recommendation Register
The system SHALL produce a prioritized register of risks and recommendations.

#### Scenario: Security risk is documented
- **WHEN** the audit identifies an inconsistency or possible access issue
- **THEN** it SHALL include severity, affected role, affected module, evidence, impact and recommendation.

#### Scenario: Recommendation requires functional change
- **WHEN** a recommendation would modify guards, routes, DB permissions or frontend checks
- **THEN** the audit SHALL mark whether it is implemented in this change or deferred to follow-up work.
- **AND** deferred work SHALL keep evidence and rationale.

### Requirement: Read-Only Audit Execution
The system SHALL keep audit SQL read-only while allowing separate idempotent implementation SQL when required.

#### Scenario: Audit artifacts are generated
- **WHEN** audit implementation runs
- **THEN** it SHALL create or update documentation and optional read-only extraction scripts.

#### Scenario: Mutation is attempted
- **WHEN** a proposed audit SQL script would execute `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP` or change application authorization logic
- **THEN** that script SHALL NOT be placed under `scripts/database/audit`.
- **AND** any implementation SQL SHALL be placed under a security migration/seed path and be idempotent.

### Requirement: Official Role Access Model
The system SHALL enforce the official access model for `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` and `USER`.

#### Scenario: SUPER_ADMIN requests global access
- **WHEN** a `SUPER_ADMIN` accesses modules, tenants, branches, reports or operational data
- **THEN** the system SHALL allow global access unless the operation requires selecting an operational context.

#### Scenario: SUPER_USER requests tenant-scoped access
- **WHEN** a `SUPER_USER` accesses operational or tenant administration modules
- **THEN** the system SHALL allow access only inside the authenticated tenant.
- **AND** it SHALL deny access to other tenants and SUPER_ADMIN-only internal modules.

#### Scenario: ADMIN requests branch-scoped access
- **WHEN** an `ADMIN` accesses operational modules
- **THEN** the system SHALL allow access only inside the authenticated tenant and assigned branch scope.
- **AND** it SHALL deny global settings, roles administration and cross-branch access.

#### Scenario: USER requests basic operational access
- **WHEN** a `USER` accesses POS, allowed orders, allowed purchases, inventory lookup or active cash context
- **THEN** the system SHALL allow only basic operational access inside the authenticated tenant and branch/context.
- **AND** it SHALL deny configuration, users, roles, global reports and destructive actions not explicitly permitted.

### Requirement: Backend Authorization Enforcement
The system SHALL enforce sensitive access in backend guards, permissions and scope validation.

#### Scenario: Sensitive endpoint is called
- **WHEN** a protected backend endpoint is called
- **THEN** it SHALL require JWT authentication.
- **AND** it SHALL require role, module permission or domain authorization.
- **AND** it SHALL validate tenant scope and branch scope where applicable.

#### Scenario: Tenant or branch scope is invalid
- **WHEN** an authenticated user sends a `tenantId` or `branchId` outside their allowed scope
- **THEN** the backend SHALL reject the request with a clear forbidden or bad request response according to existing patterns.

#### Scenario: Public endpoint exists
- **WHEN** an endpoint remains public
- **THEN** the evidence SHALL document why it is public and what data exposure is acceptable.

### Requirement: Frontend Authorization Enforcement
The system SHALL centralize frontend menu, route and action decisions using effective permissions.

#### Scenario: Menu is rendered
- **WHEN** the lateral menu is built for an authenticated user
- **THEN** it SHALL include only menu items allowed by role, module permission and route permission.

#### Scenario: Direct route is requested
- **WHEN** an authenticated user enters a forbidden route by URL
- **THEN** the frontend SHALL show a forbidden page or redirect to an allowed dashboard.

#### Scenario: Action button is rendered
- **WHEN** a page renders actions such as create, edit, delete, cancel, export, adjust inventory, close cash, users or roles management
- **THEN** the action SHALL be hidden or disabled unless `canPerformAction` allows it.

### Requirement: Database Permission Alignment
The system SHALL align configured menu permissions with the official role matrix through safe SQL.

#### Scenario: Missing permission is detected
- **WHEN** a required menu permission is missing from configured seeds or migrations
- **THEN** the change SHALL provide an idempotent security SQL script that inserts or updates only the missing permission safely.

#### Scenario: Existing permission is broader than desired
- **WHEN** an existing permission grants broader access than the official matrix
- **THEN** the change SHALL document the risk and only reduce access when the affected behavior is understood and tested.

### Requirement: Access Control Verification
The system SHALL include automated or documented verification for the access model.

#### Scenario: Backend tests run
- **WHEN** backend access tests execute
- **THEN** they SHALL validate allowed responses for each official role and denied responses for out-of-scope tenant, branch or module access.

#### Scenario: Frontend tests are unavailable
- **WHEN** the frontend has no test infrastructure for route/menu authorization
- **THEN** the evidence SHALL document that limitation and include a manual QA checklist by role.

