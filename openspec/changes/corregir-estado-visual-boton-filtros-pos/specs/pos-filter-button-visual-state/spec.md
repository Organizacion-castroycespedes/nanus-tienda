## ADDED Requirements

### Requirement: POS filter button remains legible when filters are active
El boton `Filtros` del POS SHALL keep icon, text, badge and chevron visible with sufficient contrast when filters are active.

#### Scenario: No filters active
- **WHEN** the POS header is visible and no product catalog filters are active
- **THEN** the `Filtros` button SHALL show its icon, text and chevron in the normal visual state.

#### Scenario: Category filter active
- **WHEN** the operator applies a category filter
- **THEN** the `Filtros` button SHALL still show its icon, text, badge and chevron
- **AND** the button SHALL NOT appear as a blank white rectangle.

#### Scenario: Hover and focus with filters active
- **WHEN** the operator hovers or focuses the `Filtros` button while filters are active
- **THEN** the button SHALL keep visible contrast for text and icons.

### Requirement: POS filter button fix stays visual-only
La correccion del boton `Filtros` SHALL NOT alter product filtering logic, cart state, sales flow, pricing, taxes, stock or promotions.

#### Scenario: Visual state changes
- **WHEN** the active visual state of the `Filtros` button is changed
- **THEN** product filtering logic SHALL remain unchanged
- **AND** POS sale operations SHALL remain unchanged.
