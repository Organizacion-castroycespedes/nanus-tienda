## ADDED Requirements

### Requirement: Post-login operational context resolution
The system SHALL resolve an authenticated user's operational context from the login flow according to role, tenant, assigned branches, selected terminal and active cash/POS session requirements.

#### Scenario: USER logs in with one assigned branch
- **WHEN** a `USER` completes login and has exactly one assigned branch
- **THEN** the system SHALL use the authenticated tenant from the token
- **AND** it SHALL preselect the assigned branch
- **AND** it SHALL require terminal selection from terminals allowed for that branch before POS operation

#### Scenario: ADMIN logs in with multiple assigned branches
- **WHEN** an `ADMIN` completes login and has multiple assigned branches
- **THEN** the system SHALL use the authenticated tenant from the token
- **AND** it SHALL allow selecting only assigned branches
- **AND** it SHALL require terminal selection from the selected branch

#### Scenario: SUPER_USER logs in
- **WHEN** a `SUPER_USER` completes login
- **THEN** the system SHALL use the authenticated tenant from the token
- **AND** it SHALL allow selecting branches only inside that tenant
- **AND** it SHALL require terminal selection from the selected branch

#### Scenario: SUPER_ADMIN logs in
- **WHEN** a `SUPER_ADMIN` completes login
- **THEN** the system SHALL preserve global tenant, branch and terminal selection capabilities already supported by the application
- **AND** it SHALL still require a valid operational context before POS operation

### Requirement: Backend validation of operational context
The backend SHALL validate tenant, branch, terminal and session identifiers for every sensitive operational request.

#### Scenario: Request sends branch outside scope
- **WHEN** an authenticated user sends a `branchId` outside the user's allowed tenant or branch scope
- **THEN** the backend SHALL reject the request with `403`

#### Scenario: Request sends terminal outside scope
- **WHEN** an authenticated user sends a `terminalId` outside the selected or allowed branch scope
- **THEN** the backend SHALL reject the request with `403`

#### Scenario: Request sends POS session outside scope
- **WHEN** an authenticated user sends `x-pos-session-id` for a session outside the allowed tenant, branch or terminal
- **THEN** the backend SHALL reject the request with `403`

### Requirement: Context persistence and refresh
The frontend SHALL persist operational context only as UX state and SHALL revalidate or refresh it through backend-controlled data before protected operation.

#### Scenario: Stored context is missing
- **WHEN** an authenticated user opens a protected operational route with no stored terminal/context
- **THEN** the frontend SHALL redirect to the controlled context selector or show a clear context-required screen

#### Scenario: Stored context is no longer allowed
- **WHEN** a stored branch or terminal no longer appears in backend-allowed context options
- **THEN** the frontend SHALL clear that context and require reselection

