## ADDED Requirements

### Requirement: Specific liquor tax keeps pricing amount
The FactuCore mapper SHALL send ICL (tax scheme `32`) with the specific tariff and tax amount produced by Manus pricing, without applying a percentage formula.

#### Scenario: Whisky 40 degrees 1000 ml
- **WHEN** a line has ICL rate `360`, taxable base `53.33` and amount `19200.00`
- **THEN** the mapped ICL tax SHALL have rate `360`, taxable base `53.33` and tax amount `19200`

### Requirement: Percentage taxes use DIAN rounding
The FactuCore mapper SHALL normalize fractional percentage rates to DIAN percent points and SHALL recompute their amount from their own taxable base with DIAN half-up rounding.

#### Scenario: ADV and IVA on liquor line
- **WHEN** a line has ADV rate `0.25` over base `229238` and IVA rate `0.05` over base `145455.71`
- **THEN** the mapped ADV SHALL have rate `25` and amount `57309.5`
- **AND** the mapped IVA SHALL have rate `5` and amount `7272.79`

### Requirement: Liquor taxes scale by quantity only from product profile
The sale billing snapshot SHALL scale ICL and ADV taxable base and amount by quantity only when the product tax profile proves the stored tax snapshot is per unit.

#### Scenario: Line snapshot for two units is kept
- **WHEN** a line of quantity `2` has ICL base `58` and amount `20880` and the profile expects ICL line base `58`
- **THEN** the billing snapshot SHALL keep ICL base `58` and amount `20880`

#### Scenario: Unit snapshot for three units is scaled
- **WHEN** a line of quantity `3` has ADV base `180867` and the profile expects ADV line base `542601`
- **THEN** the billing snapshot SHALL send ADV base `542601` and amount `135650.25`

### Requirement: Liquor fiscal base rebuilds the shelf price
For liquor products with non-included ICL, ADV and IVA, `price_without_tax + ICL + ADV + IVA` SHALL equal `price_with_tax`.

#### Scenario: Drifted fiscal base is realigned
- **WHEN** a liquor product has `price_with_tax` `88096.80`, ICL `10440`, ADV `11250` and a `price_without_tax` that does not rebuild it
- **THEN** the migration SHALL set `price_without_tax` to `63244.57`
- **AND** `price_with_tax` SHALL remain `88096.80`

### Requirement: Payment equals document total
The single payment amount sent to FactuCore SHALL equal the sum of line base plus mapped tax amounts.

#### Scenario: Liquor sale paid in cash
- **WHEN** the whisky line has base `145455.71` and taxes `19200`, `57309.5`, `7272.79`
- **THEN** the mapped payment amount SHALL be `229238.00`
