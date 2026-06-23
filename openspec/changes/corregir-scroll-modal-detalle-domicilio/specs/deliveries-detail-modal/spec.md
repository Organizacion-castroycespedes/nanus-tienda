## ADDED Requirements

### Requirement: Delivery detail modal scroll
The delivery detail modal SHALL keep all detail content and actions accessible within the viewport.

#### Scenario: Detail content scrolls vertically
- **WHEN** the detail content is taller than the current viewport
- **THEN** the modal content area scrolls vertically inside the modal
- **AND** the page behind the modal does not need horizontal scrolling to access detail fields

#### Scenario: Action buttons remain accessible
- **WHEN** a delivery detail has state actions available
- **THEN** the action controls remain visible or reachable inside the modal scroll area
- **AND** no delivery state action is removed or functionally changed by the scroll fix

#### Scenario: Modal avoids horizontal overflow
- **WHEN** field values such as UUIDs, addresses or notes are long
- **THEN** the modal wraps or clips content within its width
- **AND** it does not create global horizontal overflow

#### Scenario: Desktop and mobile viewports work
- **WHEN** the detail modal opens on desktop or mobile widths
- **THEN** the modal height stays within the viewport
- **AND** content, footer and close controls remain usable
