## ADDED Requirements

### Requirement: Thermal 80 mm safe width

The POS ticket PDF generated for `THERMAL_80MM` SHALL reserve a safe content
width within the nominal 80 mm paper width and SHALL NOT position content at
the physical paper edges.

#### Scenario: Render an 80 mm POS ticket

- **WHEN** Reportería generates a POS sale ticket
- **THEN** the PDF SHALL retain 80 mm nominal paper width and use defined safe horizontal margins

### Requirement: Monetary values remain visible

Ticket monetary values SHALL be allocated a right-aligned column within the
safe content width and SHALL remain fully visible.

#### Scenario: Render a long formatted monetary value

- **WHEN** an item, payment or total has a formatted monetary value
- **THEN** the value SHALL be placed in its reserved right-aligned column without extending beyond safe width

### Requirement: Long identifiers and item names

Long identifiers and product names SHALL wrap or receive visual break points
within the safe content width without removing required information.

#### Scenario: Render a UUID-like sale identifier

- **WHEN** ticket metadata contains a long unbroken identifier
- **THEN** the identifier SHALL be rendered with safe line-breaking opportunities

### Requirement: Browser physical print compatibility

The ticket layout SHALL be usable through browser PDF printing and a standard
80 mm Windows printer driver without requiring a manual scale workaround.

#### Scenario: Print from PDF preview

- **WHEN** an administrator invokes print from the Reportería PDF preview
- **THEN** the generated document SHALL be suitable for an 80 mm paper setting and standard scale

### Requirement: No business logic regression

The layout change SHALL NOT change sales totals, taxes, payments, discounts,
quantities, sale data or business rules.

#### Scenario: Render a ticket dataset

- **WHEN** the layout is generated from a sale ticket dataset
- **THEN** all supplied financial values SHALL be preserved as presentation input
