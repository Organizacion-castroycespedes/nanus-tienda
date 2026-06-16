## ADDED Requirements

### Requirement: USER operational permissions
The system SHALL allow `USER` to perform basic operational actions inside the authenticated tenant and assigned branch scope only.

#### Scenario: USER manages cash session in assigned branch
- **WHEN** a `USER` opens or closes cash session for an assigned branch and valid terminal/context
- **THEN** the backend SHALL allow the action

#### Scenario: USER creates or updates order in assigned branch
- **WHEN** a `USER` creates or updates an order for an assigned branch
- **THEN** the backend SHALL allow the action

#### Scenario: USER creates or updates customer in allowed scope
- **WHEN** a `USER` creates or updates a customer or basic electronic-invoicing customer data inside allowed scope
- **THEN** the backend SHALL allow the action

#### Scenario: USER attempts cross-branch operation
- **WHEN** a `USER` opens/closes caja, creates/updates order, or creates/updates customer outside assigned branch or tenant scope
- **THEN** the backend SHALL reject the action with `403`

### Requirement: ADMIN operational permissions
The system SHALL allow `ADMIN` to perform branch-scoped operational management without granting global configuration or peripheral administration.

#### Scenario: ADMIN manages cash session in assigned branch
- **WHEN** an `ADMIN` opens or closes cash session for an assigned branch and valid terminal/context
- **THEN** the backend SHALL allow the action

#### Scenario: ADMIN creates or updates customer in allowed scope
- **WHEN** an `ADMIN` creates or updates a customer or basic electronic-invoicing customer data inside assigned tenant and branch scope
- **THEN** the backend SHALL allow the action

#### Scenario: ADMIN reads operational inventory
- **WHEN** an `ADMIN` reads products, purchases, units, taxes, suppliers, promotions, pricing or inventory inside assigned tenant and branch scope
- **THEN** the backend SHALL allow read access

#### Scenario: ADMIN sees menu
- **WHEN** an `ADMIN` menu is rendered
- **THEN** `/admin/peripherals` SHALL NOT be listed
- **AND** `/configuracion` SHALL NOT be listed

#### Scenario: ADMIN attempts restricted route
- **WHEN** an `ADMIN` opens `/admin/peripherals` or `/configuracion` by direct URL
- **THEN** the frontend SHALL block the route or redirect to an allowed page
- **AND** backend endpoints behind those routes SHALL remain protected where applicable

### Requirement: SUPER_USER tenant permissions
The system SHALL allow `SUPER_USER` to manage tenant-scoped operational data without granting global role administration or cross-tenant access.

#### Scenario: SUPER_USER lists assignable roles
- **WHEN** a `SUPER_USER` requests roles for user management
- **THEN** the backend SHALL return only roles assignable inside the authenticated tenant

#### Scenario: SUPER_USER attempts global role mutation
- **WHEN** a `SUPER_USER` attempts to create, update or delete global roles or assign roles above its level
- **THEN** the backend SHALL reject the action with `403`

#### Scenario: SUPER_USER manages customers in tenant
- **WHEN** a `SUPER_USER` lists, creates or updates customer or basic electronic-invoicing customer data inside the authenticated tenant
- **THEN** the backend SHALL allow the action

#### Scenario: SUPER_USER manages inventory in tenant
- **WHEN** a `SUPER_USER` reads, creates or updates products, purchases, units, taxes, suppliers, promotions, pricing or stock inside the authenticated tenant
- **THEN** the backend SHALL allow the action

#### Scenario: SUPER_USER attempts cross-tenant operation
- **WHEN** a `SUPER_USER` sends tenant, branch or terminal data from another tenant
- **THEN** the backend SHALL reject the action with `403`

### Requirement: Permission seed alignment
The repository SHALL include safe idempotent SQL when missing configured permissions are the cause of denied operational actions.

#### Scenario: Missing DB permission is found
- **WHEN** a required role/menu/action permission is absent from seed or migration configuration
- **THEN** the change SHALL add an idempotent SQL script under `scripts/database/security/`
- **AND** the script SHALL avoid duplicate rows and avoid deleting existing permissions without evidence

#### Scenario: SQL is documented
- **WHEN** a security permission SQL script is added
- **THEN** the runbook or evidence SHALL state it was not executed in production

