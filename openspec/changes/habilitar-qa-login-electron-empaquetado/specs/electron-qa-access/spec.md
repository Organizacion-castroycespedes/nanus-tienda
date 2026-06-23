## ADDED Requirements

### Requirement: Packaged Electron QA access path

The system SHALL provide a safe QA access path for packaged Electron manual testing without weakening production authentication.

#### Scenario: QA local access is allowed
QA can reach POS in packaged Electron using an approved QA/local configuration.

#### Scenario: Production login stays unchanged
Production login behavior remains unchanged.

#### Scenario: No secrets are introduced
No hardcoded credentials or tokens are introduced.

#### Scenario: Bypass stays explicit
reCAPTCHA or equivalent protection is only bypassed when an explicit non-production configuration allows it.

### Requirement: Electron authentication compatibility

The packaged Electron shell SHALL support the existing web authentication flow when pointed to a valid Manus POS web environment.

#### Scenario: Login page loads
Login page loads in packaged Electron.

#### Scenario: Session persists
Successful authentication persists session as expected.

#### Scenario: Redirect reaches tenant POS
Redirect to tenant POS works when credentials and environment are valid.

#### Scenario: Session handling stays documented
Cookie/session behavior is documented if Electron requires special handling.

### Requirement: QA evidence for blocked scanner flow

The QA process SHALL distinguish authentication blockage from scanner functionality.

#### Scenario: Auth blockage stays separate
Login blocked state is recorded as BLOCKED, not FAIL for scanner HID.

#### Scenario: Scanner pass waits for POS
Scanner HID tests are only marked PASS after reaching POS.

#### Scenario: Evidence records the blocker
Evidence documents the exact environment, URL, and blocker.
