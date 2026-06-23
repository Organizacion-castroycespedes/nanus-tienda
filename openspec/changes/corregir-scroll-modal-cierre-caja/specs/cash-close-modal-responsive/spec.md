# cash-close-modal-responsive Specification

## ADDED Requirements

### Requirement: Cash close modal responsive scroll

The cash close modal SHALL keep all content and final actions accessible within the viewport on small screens.

#### Scenario: Modal content scrolls vertically

- **WHEN** the cash close modal content is taller than the available viewport
- **THEN** the close form content scrolls vertically inside the modal
- **AND** the modal itself does not exceed the viewport height.

#### Scenario: Final actions remain accessible

- **WHEN** the user opens the cash close modal on a reduced-height screen
- **THEN** the final action buttons remain visible or reachable
- **AND** `Cancelar` and `Cerrar caja` are not pushed outside the viewport.

#### Scenario: No horizontal overflow

- **WHEN** the cash close modal is opened on mobile or narrow screens
- **THEN** the modal does not introduce global horizontal overflow
- **AND** large internal tables keep their own contained scrolling behavior.

#### Scenario: Closing behavior remains unchanged

- **WHEN** the user enters the counted cash amount and confirms close
- **THEN** the same close payload and callbacks are used
- **AND** cash close calculations, ticket behavior, audit behavior, payments, POS, and deliveries remain unchanged.
