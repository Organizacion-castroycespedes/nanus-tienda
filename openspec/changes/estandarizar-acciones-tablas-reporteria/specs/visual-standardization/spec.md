## ADDED Requirements

### Requirement: Shared row action presentation

The shared row action component SHALL be visual-only and SHALL accept actions
from the owning module without defining or changing their business contracts.

#### Scenario: Preserve module actions

- **WHEN** a report row renders its existing action buttons inside the shared menu
- **THEN** labels, order, callbacks, permissions, visibility, disabled/loading state and errors SHALL remain unchanged

#### Scenario: Keep Product behavior

- **WHEN** ProductRowActions renders
- **THEN** product edit, barcode, stock, price and delete behavior SHALL remain unchanged

### Requirement: Viewport-safe compact menu

The row action menu SHALL render through a body portal, remain within the viewport,
reposition on scroll and resize, and open upward when the lower viewport lacks
space.

#### Scenario: POS-sized viewport

- **WHEN** a row action trigger is used at 800x600, 1024x768 or 1280x720
- **THEN** the menu SHALL not be clipped by the table scroll container or viewport edge

### Requirement: Accessible interaction

The menu SHALL support keyboard trigger access, Escape close with focus return,
outside click close, and native button activation for touch and pointer users.

#### Scenario: Keyboard navigation

- **WHEN** a user opens a typed row action menu and presses Arrow keys, Home, End or Escape
- **THEN** focus and visibility SHALL change without invoking an unrelated action

### Requirement: Compact operational sales presentation

`operations/sales` SHALL use the compact report shell and retain all current
filters, automatic queries, sorting, pagination, navigation, permissions and
messages.

#### Scenario: Existing operational sales filters

- **WHEN** a user changes or clears an operational sales filter
- **THEN** the existing hook-driven query and result behavior SHALL remain intact

### Requirement: Route-specific action coverage

Each route SHALL retain its own action set. POS, Cash closings, Cash audits,
Purchases, Orders and Customers SHALL preserve their existing actions.
`operations/sales` SHALL NOT gain an invented action column when none exists.

#### Scenario: Cash tabs

- **WHEN** the user switches between Cierres and Arqueos
- **THEN** each tab SHALL show only its existing ticket view and download actions

