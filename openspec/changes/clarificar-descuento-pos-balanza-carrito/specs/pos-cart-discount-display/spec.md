## ADDED Requirements

### Requirement: POS cart discount display for weighted quantities
The POS cart SHALL present promotion discounts without ambiguity when quantity is different from one or when the product is sold by weight.

#### Scenario: Promotion with quantity one
- **WHEN** a cart item has a valid promotion discount
- **AND** its quantity is exactly one
- **AND** it is not being displayed as a weighted/decimal line
- **THEN** the cart SHALL keep a compact message such as `Descuento $ 400 (10%)`.

#### Scenario: Promotion with integer quantity greater than one
- **WHEN** a cart item has a valid promotion discount
- **AND** its quantity is greater than one
- **THEN** the cart SHALL show the unit discount and the total line saving.

#### Scenario: Promotion with weighted decimal quantity
- **WHEN** a cart item has a valid promotion discount
- **AND** the product is sold by weight or has decimal quantity
- **THEN** the cart SHALL show the unit discount and the total line saving.
- **AND** for the Cafe example with quantity `1.25`, base price `$4.000`, final price `$3.600`, and discount percent `10`, the displayed message SHALL be equivalent to `Descuento $ 400 c/u  Ahorro total $ 500 (10%)`.

### Requirement: POS cart totals remain unchanged
The POS cart discount display change SHALL NOT alter the pricing, taxes, stock, promotion application or sale payload.

#### Scenario: Discount display changes
- **WHEN** the discount label is rendered
- **THEN** the line total SHALL continue using the existing pricing values
- **AND** item taxes SHALL continue using the existing tax values
- **AND** stock display SHALL remain unchanged
- **AND** the sale flow SHALL remain unchanged.

### Requirement: POS cart discount display sanitizes invalid values
The POS cart SHALL NOT display invalid discount values.

#### Scenario: Invalid discount data
- **WHEN** discount values are missing, non-finite, zero or negative
- **THEN** the cart SHALL avoid showing `NaN`, `undefined`, `null`, negative savings, or invented percentages.
