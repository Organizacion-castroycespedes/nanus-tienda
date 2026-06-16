## ADDED Requirements

### Requirement: Catalog action focus mode
The system SHALL provide Focus UX para acciones de catalogo in Clientes, Unidades, Proveedores and Impuestos by hiding or visually removing the normal filters, list and secondary actions while the action is active.

#### Scenario: Start create action
- **WHEN** an authorized user starts creating a customer, unit, supplier or tax
- **THEN** the page SHALL show the active form as the primary content
- **AND** the normal filters and list SHALL NOT be visible until the user returns or cancels.

#### Scenario: Start edit action
- **WHEN** an authorized user starts editing a customer, unit, supplier or tax
- **THEN** the page SHALL show an active-action header and the edit form as the primary content
- **AND** the normal filters and list SHALL NOT be visible until the user returns or cancels.

#### Scenario: Start delete action when supported
- **WHEN** an authorized user starts a delete action in a catalog module that supports delete
- **THEN** the destructive confirmation SHALL stay inside the focused action area
- **AND** the normal filters and list SHALL NOT compete visually with the delete confirmation.

#### Scenario: Cancel active action
- **WHEN** the user cancels or goes back from an active create or edit action
- **THEN** the page SHALL return to the list view without clearing the loaded list, filters or pagination state.

### Requirement: Catalog save confirmation dialog
The system SHALL show a non-destructive confirmation dialog after successful create or edit in Clientes, Unidades, Proveedores and Impuestos.

#### Scenario: Create succeeds
- **WHEN** a customer, unit, supplier or tax is created successfully
- **THEN** the system SHALL show a `ConfirmDialog` with `hideCancel` and confirm text `Entendido`
- **AND** the dialog SHALL describe the successful create action.

#### Scenario: Edit succeeds
- **WHEN** a customer, unit, supplier or tax is updated successfully
- **THEN** the system SHALL show a `ConfirmDialog` with `hideCancel` and confirm text `Entendido`
- **AND** the dialog SHALL describe the successful update action.

#### Scenario: Dialog closed
- **WHEN** the user confirms or closes the success dialog
- **THEN** the dialog state SHALL clear
- **AND** subsequent actions SHALL remain available without page reload.

### Requirement: Catalog focus mode preserves existing behavior
The system SHALL preserve existing list, filter, pagination, permission and error behavior while adding focus UX.

#### Scenario: Error during save
- **WHEN** create or edit fails in a focused catalog action
- **THEN** the page SHALL keep the existing error handling
- **AND** it SHALL NOT show a success confirmation dialog.

#### Scenario: Mobile usage
- **WHEN** the page is used on a mobile viewport
- **THEN** the active form and confirmation dialog SHALL remain usable without mixing visually with the hidden list.

### Requirement: Reusable catalog focus guidance
The system SHALL document the Focus UX para acciones de catalogo pattern for future catalog modules.

#### Scenario: Technical guide exists
- **WHEN** a developer needs to implement the pattern in another catalog module
- **THEN** the repository SHALL provide `docs/frontend/catalog-action-focus-ux.md`
- **AND** the guide SHALL describe when to use `FocusActionLayout`, when to use `ConfirmDialog`, implementation rules, technical validation and manual QA.

#### Scenario: Evidence records manual QA status
- **WHEN** the change is technically validated but browser QA is not executed
- **THEN** the evidence SHALL state PASS tecnico
- **AND** it SHALL state QA visual manual pendiente without marking visual PASS.
