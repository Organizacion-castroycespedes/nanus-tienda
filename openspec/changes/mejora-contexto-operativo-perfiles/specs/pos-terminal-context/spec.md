## ADDED Requirements

### Requirement: Controlled POS context selection
The system SHALL make `/pos/select-context` a controlled authenticated step for choosing only allowed branch and terminal combinations.

#### Scenario: User opens selector without valid session
- **WHEN** an unauthenticated user opens `/pos/select-context`
- **THEN** the frontend SHALL redirect to login or deny access according to the existing auth flow

#### Scenario: USER opens selector
- **WHEN** a `USER` opens `/pos/select-context`
- **THEN** the selector SHALL show no tenant choice
- **AND** it SHALL show only the assigned branch if branch selection is needed
- **AND** it SHALL show only terminals associated with the assigned branch

#### Scenario: ADMIN opens selector
- **WHEN** an `ADMIN` opens `/pos/select-context`
- **THEN** the selector SHALL show only assigned branches
- **AND** it SHALL show only terminals associated with the selected assigned branch

#### Scenario: SUPER_USER opens selector
- **WHEN** a `SUPER_USER` opens `/pos/select-context`
- **THEN** the selector SHALL show only branches in the authenticated tenant
- **AND** it SHALL show only terminals associated with the selected branch in that tenant

### Requirement: POS route requires complete context
The system SHALL block POS operation until tenant, branch, terminal and required session context are valid.

#### Scenario: POS opened without terminal
- **WHEN** an authenticated user opens `/pos` without selected terminal/context
- **THEN** the frontend SHALL redirect to `/pos/select-context` or show a context-required screen

#### Scenario: POS opened with invalid stored context
- **WHEN** an authenticated user opens `/pos` with stored context that backend no longer allows
- **THEN** the frontend SHALL clear the stored context
- **AND** it SHALL require context selection before POS operation

#### Scenario: POS API receives invalid context
- **WHEN** a POS request includes a terminal, branch or POS session outside allowed scope
- **THEN** the backend SHALL reject the request with `403`

### Requirement: Terminal options are backend-filtered
The backend SHALL provide or enforce terminal lists filtered by authenticated tenant, branch and role scope.

#### Scenario: USER lists terminals
- **WHEN** a `USER` requests terminals for context selection
- **THEN** the backend SHALL return only terminals from assigned branches

#### Scenario: ADMIN lists terminals
- **WHEN** an `ADMIN` requests terminals for context selection
- **THEN** the backend SHALL return only terminals from assigned branches

#### Scenario: SUPER_USER lists terminals
- **WHEN** a `SUPER_USER` requests terminals for context selection
- **THEN** the backend SHALL return only terminals from the authenticated tenant

#### Scenario: Cross-tenant terminal requested
- **WHEN** any non-`SUPER_ADMIN` user requests or submits a terminal from another tenant
- **THEN** the backend SHALL reject the request with `403`
