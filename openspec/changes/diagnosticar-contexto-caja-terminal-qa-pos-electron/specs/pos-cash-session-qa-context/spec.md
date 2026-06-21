## ADDED Requirements

### Requirement: POS QA cash-session blocker diagnosis

The system SHALL document cash-session and terminal context blockers that prevent packaged Electron POS QA.

#### Scenario: record authenticated scope

- Given a QA user is authenticated
- When packaged Electron reaches the POS path
- Then the diagnosis records the tenant, branch, terminal, and cash register scope when available

#### Scenario: record conflicting messages

- Given POS and finance views report different cash-session states
- When the blocker is analyzed
- Then the diagnosis records the exact messages from each view

#### Scenario: distinguish scanner failure

- Given scanner HID QA has not run
- When the blocker is documented
- Then the diagnosis distinguishes cash-session setup blockers from scanner HID failures

### Requirement: No destructive QA remediation

The diagnostic phase SHALL NOT mutate cash-session data.

#### Scenario: no SQL writes

- Given the blocker is under review
- When the diagnosis is performed
- Then no SQL update, delete, or insert is executed

#### Scenario: no business bypass

- Given the blocker is under review
- When the diagnosis is performed
- Then no permission or business rule bypass is introduced

### Requirement: Safe QA unblock recommendation

The system SHALL identify a safe path to unblock packaged Electron POS QA.

#### Scenario: recommend reusable QA setup

- Given the blocker is diagnosed
- When the evidence is written
- Then the document recommends a reusable QA user, cash register, and terminal setup

#### Scenario: defer SQL fixture work

- Given the blocker could be solved by data changes
- When the recommendation is written
- Then SQL fixture remediation is deferred to a separate approved phase
