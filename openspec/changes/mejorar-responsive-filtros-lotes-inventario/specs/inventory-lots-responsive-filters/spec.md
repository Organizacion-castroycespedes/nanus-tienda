## ADDED Requirements

### Requirement: Inventory lots filters fit inside available width
La vista Inventario > Lotes SHALL render filter controls inside the available content width without causing global horizontal overflow.

#### Scenario: Reduced desktop viewport
- **WHEN** the operator opens `/inventory/lots` around `1342 x 802`
- **THEN** search, branch, product, status, location, expiration date filters, availability checkbox, action buttons and rows selector SHALL remain visible inside the filter card
- **AND** the filter card SHALL NOT overflow horizontally outside the page content.

#### Scenario: Tablet viewport
- **WHEN** the operator opens `/inventory/lots` around `1024 x 768`
- **THEN** the filters SHALL wrap into multiple rows
- **AND** each control SHALL remain usable without being cut off.

#### Scenario: Mobile viewport
- **WHEN** the operator opens `/inventory/lots` around `390 x 844`
- **THEN** filters SHALL stack or use a single-column layout
- **AND** no filter action SHALL be outside the visible page width.

### Requirement: Inventory lots table scroll remains internal
La tabla de lotes SHALL keep horizontal scrolling scoped to the table wrapper when columns exceed available width.

#### Scenario: Table columns exceed viewport
- **WHEN** the lots table has more columns than the viewport can display
- **THEN** horizontal scroll SHALL be available inside the table panel
- **AND** the filter card SHALL NOT create global horizontal page scroll.

### Requirement: Inventory lots filters remain functional
La correccion responsive SHALL NOT alter lot filter semantics or inventory business behavior.

#### Scenario: Filters used after responsive fix
- **WHEN** the operator searches, clears filters, toggles `Solo disponibles`, or changes page size
- **THEN** the existing handlers and filter semantics SHALL remain unchanged.
