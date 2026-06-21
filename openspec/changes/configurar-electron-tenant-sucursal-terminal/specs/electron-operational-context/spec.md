## ADDED Requirements

### Requirement: Electron operational context configuration

The Electron shell SHALL resolve optional tenant, branch, and terminal context from local configuration inputs without changing backend business behavior.

#### Scenario: Electron reads tenant id from environment configuration

- **WHEN** `MANUS_TENANT_ID` is configured
- **THEN** the Electron configuration helper SHALL expose it as the initial tenant context

#### Scenario: Electron reads branch id from environment configuration

- **WHEN** `MANUS_BRANCH_ID` is configured
- **THEN** the Electron configuration helper SHALL expose it as reserved local branch context

#### Scenario: Electron reads terminal id from environment configuration

- **WHEN** `MANUS_TERMINAL_ID` is configured
- **THEN** the Electron configuration helper SHALL expose it as reserved local terminal context

#### Scenario: Branch and terminal context do not create POS sessions in this phase

- **WHEN** branch or terminal context is configured
- **THEN** Electron SHALL NOT create POS sessions, open cash sessions or change permissions from local config alone

#### Scenario: Missing context keeps existing default online shell behavior

- **WHEN** no tenant, branch, terminal or startup path is configured
- **THEN** Electron SHALL keep loading the default online web URL behavior

### Requirement: Electron startup path resolution

The Electron shell SHALL resolve its startup URL from web base URL and optional startup path.

#### Scenario: MANUS_WEB_URL controls the web base URL

- **WHEN** `MANUS_WEB_URL` is configured
- **THEN** Electron SHALL use it as the base URL for the startup URL

#### Scenario: MANUS_START_PATH controls the startup path when provided

- **WHEN** `MANUS_START_PATH` is configured with a path that starts with `/`
- **THEN** Electron SHALL append that path to the web base URL

#### Scenario: MANUS_START_PATH takes priority over tenant-based default path

- **WHEN** both `MANUS_START_PATH` and `MANUS_TENANT_ID` are configured
- **THEN** Electron SHALL use `MANUS_START_PATH` for the startup URL

#### Scenario: Tenant id can define an initial tenant route when no explicit startup path exists

- **WHEN** `MANUS_TENANT_ID` is configured and `MANUS_START_PATH` is not configured
- **THEN** Electron SHALL use `/<tenantId>` as the startup path

#### Scenario: Invalid startup path is rejected

- **WHEN** `MANUS_START_PATH` does not start with `/`
- **THEN** Electron configuration SHALL reject the value with a clear error

### Requirement: Electron context remains online-only

The Electron shell SHALL not introduce offline storage or synchronization for tenant, branch, or terminal context.

#### Scenario: No local operational database is introduced

- **WHEN** tenant, branch or terminal context is configured
- **THEN** Electron SHALL NOT create a local operational database

#### Scenario: No sync queue is introduced

- **WHEN** tenant, branch or terminal context is configured
- **THEN** Electron SHALL NOT create a synchronization queue

#### Scenario: No POS or cash session is created from local config alone

- **WHEN** Electron starts with tenant, branch or terminal context
- **THEN** Electron SHALL NOT create POS sessions or cash sessions from local config alone

#### Scenario: Backend, SQL, and permissions remain unchanged

- **WHEN** this change is complete
- **THEN** backend, SQL, migrations and permission rules SHALL remain unchanged
