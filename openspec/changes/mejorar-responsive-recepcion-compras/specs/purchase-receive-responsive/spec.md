## ADDED Requirements

### Requirement: Purchase receive responsive layout
The purchase receive screen SHALL keep a readable layout on desktop, tablet and mobile without changing purchase receiving behavior.

#### Scenario: Desktop receive view
- **WHEN** the user opens `/{tenantId}/purchases?purchaseId=<id>&action=receive` on a wide viewport
- **THEN** the receive header, purchase summary, products section, confirmation block and buttons SHALL remain aligned, readable and constrained to the available page width.

#### Scenario: Narrow viewport receive view
- **WHEN** the user opens the receive view on a narrow viewport
- **THEN** the page SHALL NOT create unnecessary whole-page horizontal overflow
- **AND** the product section SHALL provide its own horizontal scroll.

### Requirement: Purchase receive product scroll containment
The purchase receive product section SHALL use internal horizontal scrolling when fields do not fit.

#### Scenario: Product fields need more width
- **WHEN** product columns and fields for quantity, lot, expiration date, location and unit cost do not fit in the available viewport
- **THEN** only the product section SHALL scroll horizontally
- **AND** inputs, selects and action fields SHALL keep usable minimum widths.

#### Scenario: Lot-controlled product row
- **WHEN** a product requires lot and expiration data
- **THEN** the lot, expiration date, location and unit cost fields SHALL remain visible and usable inside the internal scroll area.

### Requirement: Purchase receive behavior preservation
The responsive fix SHALL NOT change purchase receiving business behavior.

#### Scenario: Submit receive form
- **WHEN** the user confirms reception
- **THEN** the existing payload, calculations, validation and API behavior SHALL remain unchanged.

#### Scenario: Existing dialogs and feedback
- **WHEN** existing confirmation feedback or dialogs are shown
- **THEN** the responsive layout SHALL NOT alter their behavior.
