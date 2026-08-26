# pos-operational-ux Specification

## Purpose
Improve the operational UX of the POS workspace by maximizing product space, compacting secondary controls, surfacing real operational context, and adding safe feedback when a product is successfully added.

## ADDED Requirements
### Requirement: POS sidebar collapses on entry
The system SHALL collapse the authenticated tenant sidebar automatically when the user enters the POS through the menu, the top cart shortcut, or a direct POS route.

#### Scenario: Enter POS from menu
- **WHEN** an authenticated user opens the POS from the sidebar menu
- **THEN** the sidebar SHALL be collapsed for the POS view
- **AND** the POS workspace SHALL gain more horizontal space.

#### Scenario: Enter POS from top cart shortcut
- **WHEN** an authenticated user returns to the POS using the cart shortcut in the top bar
- **THEN** the sidebar SHALL be collapsed for the POS view
- **AND** the current POS workspace SHALL remain usable.

#### Scenario: Open POS directly
- **WHEN** an authenticated user opens `/[tenant]/pos` directly
- **THEN** the POS view SHALL start with the sidebar collapsed
- **AND** the user SHALL still be able to expand the sidebar manually.

### Requirement: POS filters and customer selection are compact
The system SHALL move the POS operational controls into a floating panel that stays closed by default and opens only on demand without removing existing filtering behavior.

#### Scenario: Default closed state
- **WHEN** the user enters `/[tenant]/pos`
- **THEN** the POS operational panel SHALL remain closed by default
- **AND** the workspace SHALL not reserve permanent space for that panel.

#### Scenario: Open floating POS panel
- **WHEN** the user activates the floating POS control
- **THEN** the system SHALL show the current filters and customer selection in an overlay panel or modal appropriate for the viewport
- **AND** the existing filter and customer state SHALL remain available.

#### Scenario: Close floating POS panel
- **WHEN** the user closes the overlay panel
- **THEN** the current filters and customer selection SHALL remain applied
- **AND** the user SHALL return to the product workspace.

#### Scenario: Active state visible on floating control
- **WHEN** product filters are active
- **THEN** the floating control SHALL show an active-state indicator
- **AND** the user SHALL be able to clear filters from the floating panel.

### Requirement: Floating POS controls are draggable
The system SHALL allow the floating POS control and the floating cart control to be moved by the operator, while keeping click or tap behavior intact.

#### Scenario: Drag floating POS control
- **WHEN** the user drags the floating POS control
- **THEN** the control SHALL move inside the viewport
- **AND** the release SHALL snap it toward a nearby horizontal edge.

#### Scenario: Drag floating cart control
- **WHEN** the user drags the floating cart control
- **THEN** the control SHALL move inside the viewport
- **AND** the release SHALL snap it toward a nearby horizontal edge.

#### Scenario: Click after no drag
- **WHEN** the user taps or clicks a floating control without crossing the drag threshold
- **THEN** the control SHALL execute its normal action
- **AND** the interaction SHALL not be treated as a drag.

#### Scenario: Persistence of position
- **WHEN** the user moves a floating control
- **THEN** the local visual position preference SHALL persist on the client
- **AND** refreshing the page SHALL restore the saved position.

#### Scenario: Reset to default
- **WHEN** the user clears the local visual preference
- **THEN** the floating controls SHALL return to their default positions.

#### Scenario: Pointer events and drag threshold
- **WHEN** the user interacts with a floating control by mouse, touch, or pen
- **THEN** the system SHALL use Pointer Events to handle the interaction
- **AND** a small movement threshold SHALL distinguish click or tap from drag.

#### Scenario: Clamp and snap
- **WHEN** a floating control is moved
- **THEN** the control SHALL be clamped inside the viewport
- **AND** the released control SHALL snap to the nearest horizontal edge.

### Requirement: POS products gain workspace space
The system SHALL use the recovered workspace space to present the product catalog more efficiently without changing product behavior.

#### Scenario: Desktop catalog
- **WHEN** the POS is used on desktop or tablet
- **THEN** the product area SHALL expand into the freed space
- **AND** grid/list rendering SHALL keep working as before.

#### Scenario: Product selection behavior
- **WHEN** the user adds a product from grid, list, scanner, or weighable flow
- **THEN** the existing business flow SHALL remain unchanged
- **AND** only successful adds SHALL trigger the new product-added audio feedback.

### Requirement: Mobile cart opens as a centered modal
The system SHALL keep the floating cart trigger on small screens and open the cart inside a centered modal.

#### Scenario: Open cart on mobile
- **WHEN** the user taps the floating cart button on a small screen
- **THEN** the cart SHALL open in a centered modal with overlay and internal scroll
- **AND** it SHALL remain fully functional for review and charging.

#### Scenario: Desktop cart
- **WHEN** the user uses the POS on desktop
- **THEN** the existing cart layout SHALL remain unchanged.

### Requirement: POS topbar shows operational context
The system SHALL display real operational context in the POS topbar using readable labels for role, terminal, branch, and current local date/time.

#### Scenario: Context available
- **WHEN** the user is authenticated and has a selected POS context
- **THEN** the topbar SHALL show the user role, terminal name, branch name, and local date/time
- **AND** it SHALL truncate long values without causing overflow.

#### Scenario: Context changes
- **WHEN** the selected terminal or branch changes
- **THEN** the topbar SHALL update to reflect the new operational context.

### Requirement: Product-added audio feedback
The system SHALL play a local audio cue only after a product is successfully added to the cart.

#### Scenario: Successful add
- **WHEN** a product is successfully added to the cart
- **THEN** the system SHALL attempt to play `product-added-p.mp3`
- **AND** a playback failure SHALL NOT block the add action.

#### Scenario: Failed add
- **WHEN** a product is not added because validation, stock, or business rules reject the action
- **THEN** the system SHALL NOT play the audio cue.

#### Scenario: No double audio
- **WHEN** a single user action results in one successful add
- **THEN** the system SHALL emit one audio cue only.
