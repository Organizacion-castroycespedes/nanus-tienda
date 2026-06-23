## ADDED Requirements

### Requirement: Responsive cash session summary cards
The cash sessions view SHALL render summary cards without visual overflow across desktop, tablet, and mobile widths.

#### Scenario: Monetary values remain readable
- **WHEN** monetary values are long
- **THEN** they remain readable inside metric cards
- **AND** they do not overflow the page horizontally

#### Scenario: Metric badges stay inside cards
- **WHEN** metric labels are long
- **THEN** badges wrap or fit inside their cards

#### Scenario: Cards wrap instead of narrowing too far
- **WHEN** viewport width is reduced
- **THEN** metric cards wrap into additional rows
- **AND** cards keep a readable minimum width

#### Scenario: No global horizontal overflow
- **WHEN** the page is viewed at mobile or tablet widths
- **THEN** the page does not create global horizontal overflow

#### Scenario: Existing actions remain visible
- **WHEN** the layout wraps
- **THEN** existing actions remain visible and accessible

### Requirement: Current cash session visual hierarchy
The current cash session section SHALL preserve readable hierarchy for status, totals, and action cards.

#### Scenario: Current status remains readable
- **WHEN** a current cash session exists
- **THEN** the current status block remains readable

#### Scenario: Turn management remains readable
- **WHEN** `Gestion del turno` is rendered
- **THEN** its metrics remain readable without clipping

#### Scenario: Current cash metrics remain readable
- **WHEN** `Caja abierta actual` is rendered
- **THEN** its metric values remain readable

#### Scenario: Cash count text remains readable
- **WHEN** `Ultimo arqueo` or `Arqueo` displays text such as `Sin arqueo`
- **THEN** the text remains fully visible

#### Scenario: Operational actions remain accessible
- **WHEN** the viewport is reduced
- **THEN** `Cerrar caja` and `Ver movimientos` remain accessible
