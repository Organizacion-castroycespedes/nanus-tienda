## ADDED Requirements

### Requirement: POS cash-session scope consistency

The system SHALL use a consistent tenant, branch, terminal, cash register, and user scope when opening or resolving POS cash sessions.

#### Scenario: same branch session is recognized

- Given a valid open cash session already exists for the selected cash register in the current branch
- When POS context selection resolves the current cash session
- Then the UI recognizes the open session and does not try to open a duplicate session

#### Scenario: occupied register stays occupied

- Given a different user already opened the same cash register
- When another user selects that register
- Then the system reports the register as occupied and does not silently reuse the session

#### Scenario: other branch stays blocked

- Given a cash session exists in another branch
- When the current branch is resolved
- Then the open session is not treated as valid for the wrong branch

### Requirement: Current shift consistency

The system SHALL report current shift and cash-session state using the same operational branch context expected by POS.

#### Scenario: current shift sees open branch session

- Given an open cash session exists in the current branch
- When current-shift is loaded for the current user
- Then the open session is reported instead of a false no-session state

#### Scenario: scope is still protected

- Given a cash session belongs to another branch
- When current-shift resolves the session
- Then the session is rejected for the wrong branch

### Requirement: No destructive remediation

The fix SHALL NOT mutate existing cash sessions outside normal authorized flows.

#### Scenario: no automatic close

- Given an occupied register
- When the fix runs
- Then no session is closed automatically

#### Scenario: no SQL write

- Given the issue is being corrected
- When the code runs
- Then no SQL update, delete, or insert is introduced for remediation

