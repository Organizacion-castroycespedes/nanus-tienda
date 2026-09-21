## ADDED Requirements

### Requirement: Global navigation breakpoint
The shared tenant layout SHALL use a CSS breakpoint at 1280px: at widths less than or equal to 1280px it SHALL show a compact header with an accessible hamburger and drawer/overlay; above 1280px it SHALL show a persistent sidebar.

#### Scenario: Exactly 1280 pixels
- **WHEN** the viewport width is 1280px
- **THEN** the hamburger navigation is used and the active option is visible in the drawer

#### Scenario: Desktop above breakpoint
- **WHEN** the viewport width is greater than 1280px
- **THEN** the sidebar remains persistent without oversized content scaling

### Requirement: Shared Web and Electron behavior
The responsive navigation SHALL be implemented in the shared frontend layout so Web and Electron do not receive duplicated navigation logic.

#### Scenario: Electron loads tenant layout
- **WHEN** Electron renders an affected tenant route
- **THEN** it receives the same breakpoint, drawer close behavior and active-route state as Web
