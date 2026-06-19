## ADDED Requirements

### Requirement: Selectable open cash sessions
The system SHALL expose selectable open cash sessions in the current shift response for actors whose scope can include more than one open session.

#### Scenario: SUPER_USER has multiple open sessions
- **WHEN** `SUPER_USER` requests `GET /api/reports/current-shift` for an allowed `tenantId` with multiple open sessions
- **THEN** the response includes `availableCashSessions` with each allowed `OPEN` session and enough metadata to identify branch, terminal, cash register, opening user, opened time and status

#### Scenario: Only one open session exists
- **WHEN** an actor requests current shift and only one allowed open session exists
- **THEN** the response keeps `hasOpenCashSession: true`, includes `cashSession`, and includes `availableCashSessions` with that single session

#### Scenario: No open sessions exist
- **WHEN** an actor requests current shift and no allowed open sessions exist
- **THEN** the response includes `hasOpenCashSession: false`, an empty `availableCashSessions` array, empty tabs, and a clear operative message

### Requirement: Explicit current shift filters
The system SHALL accept explicit filters for selecting or narrowing open cash sessions without breaking existing query parameters.

#### Scenario: Filter by cash session
- **WHEN** a request includes `cashSessionId`
- **THEN** the report renders that open session only if it belongs to the resolved tenant and actor scope

#### Scenario: Filter by branch terminal and cash register
- **WHEN** a request includes `branchId`, `terminalId`, or `cashRegisterId`
- **THEN** `availableCashSessions` and the default selected report are limited to matching open sessions in actor scope

#### Scenario: Search selectable sessions
- **WHEN** a request includes `search`
- **THEN** selectable sessions can be narrowed by branch name, terminal name, cash register name/code, or opening user without changing tenant isolation

### Requirement: Role-safe session visibility
The system SHALL preserve current role restrictions while adding session selection.

#### Scenario: USER remains limited
- **WHEN** `USER` requests current shift
- **THEN** `availableCashSessions` contains only open sessions that the user is authorized to operate and the user cannot select another user or branch outside scope

#### Scenario: SUPER_USER tenant scope
- **WHEN** `SUPER_USER` requests current shift for their tenant
- **THEN** the response can include open sessions across tenant branches, terminals and cash registers

#### Scenario: Cross-tenant selection is rejected
- **WHEN** any non-allowed actor requests a `tenantId` or `cashSessionId` outside their tenant scope
- **THEN** the backend rejects the request or returns no selectable session without leaking cross-tenant data

#### Scenario: Closed sessions are excluded
- **WHEN** closed or cancelled sessions exist
- **THEN** they do not appear in `availableCashSessions` and cannot be rendered as the current open shift

### Requirement: Current shift selector UI
The web app SHALL show a clear current shift session selector when the response includes multiple selectable open sessions.

#### Scenario: Multiple sessions visible
- **WHEN** `/{tenant}/finance/current-shift` receives more than one `availableCashSessions` item
- **THEN** the page shows a visible selector with branch, terminal, cash register, opening user, opened time and status for each option

#### Scenario: Selecting another session
- **WHEN** the user selects another open session
- **THEN** the page refetches `GET /api/reports/current-shift` with `cashSessionId` and refreshes summary, tabs, movements, tickets and visible context

#### Scenario: Single session context
- **WHEN** exactly one selectable session exists
- **THEN** the page may keep the current layout but MUST show explicit branch, terminal, cash register, opening user and opened time context

#### Scenario: Empty state
- **WHEN** no selectable open sessions exist
- **THEN** the page shows a clear empty state that says there are no open cash sessions for the current scope
