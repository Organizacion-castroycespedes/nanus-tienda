## ADDED Requirements

### Requirement: Line tax base closes the charged amount
Pricing SHALL derive the percentage tax base of a line from the charged line amount so that `base + round(base x rate)` plus the other line taxes equals the charged amount, with a maximum difference of `0.01`, whenever the tax is included in the price or the product has a separate customer price.

#### Scenario: Included VAT with quantity 12
- **WHEN** a product priced `1000` with included VAT `0.19` is sold in quantity `12`
- **THEN** the tax base SHALL be `10084.03`
- **AND** the tax amount SHALL be `1915.97`
- **AND** the line total SHALL remain `12000`

#### Scenario: Separate customer price with quantity 12
- **WHEN** a product has `price_with_tax` `1000`, `price_without_tax` `840.34` and excluded VAT `0.19` and is sold in quantity `12`
- **THEN** the tax base SHALL be `10084.03`
- **AND** the tax amount SHALL be `1915.97`
- **AND** the line total SHALL remain `12000`

#### Scenario: Excluded VAT without separate price is unchanged
- **WHEN** a product priced `1000` with excluded VAT `0.19` and no separate customer price is sold in quantity `3`
- **THEN** the tax base SHALL be `3000`
- **AND** the line total SHALL be `3570`

### Requirement: Liquor VAT base closes the charged amount
For liquor lines with a separate customer price, pricing SHALL compute the VAT base from the charged line amount minus ICL and ADV amounts.

#### Scenario: Liquor with separate price sold in quantity 3
- **WHEN** a liquor has `price_with_tax` `88096.80`, ICL `10440` per unit, ADV `11250` per unit and VAT `0.05` and is sold in quantity `3`
- **THEN** the tax base SHALL be `189733.71` and the VAT amount `9486.69`
- **AND** `taxBase + ICL + ADV + VAT` SHALL equal the line total `264290.40`

### Requirement: Billing unit price keeps six decimals
The sale billing snapshot SHALL send `unitPrice` as `lineSubtotal / quantity` with six decimals, and the electronic billing service SHALL persist it with six decimals.

#### Scenario: Quantity 12 line base
- **WHEN** a line has base `10084.03` and quantity `12`
- **THEN** the snapshot `unitPrice` SHALL be `840.335833`
- **AND** `round(unitPrice x quantity, 2)` SHALL equal `10084.03`
