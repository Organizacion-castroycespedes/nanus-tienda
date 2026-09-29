## ADDED Requirements

### Requirement: Tenant-safe session listing

The API SHALL list active POS sessions only for the authenticated administrator's tenant, branch, and terminal identified by internal IDs. The response SHALL expose only operational fields needed by the administrator: session ID, user display identifier, terminal, branch, start time, active state, cash activity indicator, and whether administrative closure is available.

#### Scenario: List active sessions for one terminal

- **WHEN** a `SUPER_ADMIN` with `CONFIG_TERMINALS READ` requests the session list for an active terminal in an authorized tenant and branch
- **THEN** the API returns only active sessions of that terminal and no tokens, cookies, or sessions from another tenant or branch

#### Scenario: Reject unauthorized listing

- **WHEN** a user lacks `SUPER_ADMIN`, lacks `CONFIG_TERMINALS READ`, or requests a terminal outside the authenticated tenant or branch
- **THEN** the API rejects the request and returns no session data

### Requirement: Individual administrative POS session closure

The API SHALL allow only a `SUPER_ADMIN` with `CONFIG_TERMINALS WRITE` to close one identified active POS session. The request SHALL include a non-empty administrative reason. The backend SHALL revalidate tenant, branch, terminal, session state, cash activity, and pending operations independently of frontend values.

#### Scenario: Close a safe active session

- **WHEN** the identified session is still active, belongs to the requested terminal and tenant, has no relevant open cash session, has no pending business operation, and the administrator confirms a valid reason
- **THEN** the API marks only that session inactive, sets `ended_at`, writes an administrative audit event, and leaves other sessions and business records unchanged

#### Scenario: Block closure with cash activity

- **WHEN** the identified terminal has an open own or relevant shared cash session
- **THEN** the API returns an operational conflict and changes no POS session, cash session, sale, payment, movement, Device, or binding

#### Scenario: Block closure with pending operations

- **WHEN** the identified session or its relevant cash context has a non-terminal sale, payment, or other pending business operation
- **THEN** the API returns an operational conflict and changes no record

#### Scenario: Handle a session changed concurrently

- **WHEN** another request closes or changes the identified session after the administrator list was loaded but before the close transaction completes
- **THEN** the API returns an explicit conflict or idempotent already-closed result according to the current state and does not close another session

#### Scenario: Reject repeated closure

- **WHEN** the identified session is already inactive
- **THEN** the API returns an explicit already-closed or not-found response and does not alter `ended_at` or create a duplicate close audit

### Requirement: Administrative audit

The successful administrative closure SHALL use the existing audit service and record the actor, tenant, branch, terminal, session, reason, previous active state, and resulting inactive state without storing credentials or cookies.

#### Scenario: Audit successful closure

- **WHEN** the close transaction commits
- **THEN** one audit event identifies the administrative action and the exact session that changed

### Requirement: Normal POS session lifecycle remains separate

The system SHALL preserve the existing user logout and POS context flows. Administrative closure SHALL not invalidate `auth_sessions`, close cash, deactivate all sessions of a user, or automatically restore a new POS context.

#### Scenario: Request after administrative closure

- **WHEN** a subsequent protected POS request presents the administratively closed POS session
- **THEN** the existing POS-session guard rejects it and the client must select or create a valid POS context

### Requirement: Terminal administration UI

The Web terminal administration screen SHALL show active sessions for the selected terminal and provide an individual administrative close action using the existing Design System confirmation provider. It SHALL prevent duplicate requests, stale-terminal actions, bulk closure, and native `window.confirm` or `window.alert` dialogs.

#### Scenario: Confirm an individual closure

- **WHEN** an administrator selects one active session and confirms the Design System dialog showing the real terminal, user, start time, and reason
- **THEN** the UI calls only that session's close endpoint, shows loading state, refreshes the selected terminal, and reports the actual API result

#### Scenario: Cancel closure

- **WHEN** the administrator cancels the confirmation dialog or closes it with Escape
- **THEN** no administrative endpoint is called and the session remains listed

#### Scenario: Switch terminal while panel is open

- **WHEN** the administrator closes or changes the selected terminal before an action completes
- **THEN** the UI clears stale selection and cannot apply the pending action to another terminal
