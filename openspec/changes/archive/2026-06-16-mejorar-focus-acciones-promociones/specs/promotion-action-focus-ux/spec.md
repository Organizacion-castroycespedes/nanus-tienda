## ADDED Requirements

### Requirement: Promotion focused action mode
The system SHALL render promotion create, edit and supported destructive actions inside a focused action area instead of modal dialogs.

#### Scenario: Start create promotion
- **WHEN** an authorized user starts creating a promotion
- **THEN** the page SHALL show the promotion form inside `FocusActionLayout`
- **AND** the normal filters, list and secondary actions SHALL NOT be visible until the user cancels, goes back or completes the action.

#### Scenario: Start edit promotion
- **WHEN** an authorized user starts editing a promotion
- **THEN** the page SHALL load the existing promotion data
- **AND** it SHALL show the form inside `FocusActionLayout`
- **AND** the normal filters, list and secondary actions SHALL NOT be visible until the user cancels, goes back or completes the action.

#### Scenario: Start deactivate promotion
- **WHEN** an authorized user starts deactivating an active promotion
- **THEN** the page SHALL show a focused destructive confirmation area
- **AND** it SHALL provide cancel/regresar and confirm actions without using a modal.

### Requirement: Promotion cancel and return behavior
The system SHALL provide clear cancel/regresar behavior for focused promotion actions.

#### Scenario: Cancel create or edit
- **WHEN** the user cancels or goes back from create or edit
- **THEN** the page SHALL return to the promotion list
- **AND** it SHALL preserve loaded list/filter context where the current page state already keeps it.

#### Scenario: Cancel deactivate
- **WHEN** the user cancels deactivate
- **THEN** the page SHALL return to the promotion list without changing the promotion.

### Requirement: Promotion action success feedback
The system SHALL show visual success feedback using `ConfirmDialog` after successful promotion actions.

#### Scenario: Create succeeds
- **WHEN** a promotion is created successfully
- **THEN** the system SHALL show `ConfirmDialog` with title `Promoción creada correctamente`
- **AND** it SHALL use `hideCancel`, confirm text `Entendido` and `variant="success"`.

#### Scenario: Edit succeeds
- **WHEN** a promotion is updated successfully
- **THEN** the system SHALL show `ConfirmDialog` with title `Promoción actualizada correctamente`
- **AND** it SHALL use `hideCancel`, confirm text `Entendido` and `variant="success"`.

#### Scenario: Deactivate succeeds
- **WHEN** a promotion is deactivated successfully
- **THEN** the system SHALL show `ConfirmDialog` with title `Promoción desactivada correctamente`
- **AND** it SHALL use `hideCancel`, confirm text `Entendido` and `variant="success"`.

### Requirement: Promotion behavior preservation
The system SHALL preserve existing promotion business behavior while changing the action UX.

#### Scenario: Save validation fails
- **WHEN** promotion form validation fails or API save fails
- **THEN** the focused form SHALL keep the current error handling
- **AND** it SHALL NOT show success feedback.

#### Scenario: List usage
- **WHEN** no action is active
- **THEN** the page SHALL show the existing list, filters, refresh action and create action according to permissions.

#### Scenario: Mobile usage
- **WHEN** the page is used on a mobile viewport
- **THEN** the focused form and success dialog SHALL remain usable without visually mixing with the list or filters.
