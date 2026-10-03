## 1. Pricing

- [x] 1.1 Add `resolveLineTaxBase` (line base from charged amount, DIAN half-up tax).
- [x] 1.2 Use it in `calculatePercentageOnlyBreakdown` for included VAT and separate customer price.
- [x] 1.3 Use it in `calculateAlcoholBreakdown` for included VAT and separate customer price.
- [x] 1.4 Pricing tests for quantity 12 (included, separate price, excluded unchanged) and liquor quantity 3.

## 2. Sale billing snapshot

- [x] 2.1 `unitPrice` with six decimals in `buildElectronicBillingLines`.
- [x] 2.2 Legacy branch without tax snapshot uses the line base rule.
- [x] 2.3 Sale service test for the six-decimal unit price.

## 3. Persistence and provider

- [x] 3.1 Add `V101__electronic_document_lines_unit_price_6_decimals.sql`.
- [x] 3.2 FactuCore writes `cbc:PriceAmount` with six decimals.

## 4. Verification

- [x] 4.1 Run api pricing/sale suites, `backend-facturacion-electronica` tests and FactuCore XML tests.
- [x] 4.2 Apply `V101` locally, rebuild `api` and `facturacion`, rebuild and restart FactuCore.
- [x] 4.3 Re-run the product simulation (quantities 1, 3, 12) with zero invoice vs charge differences above `0.01`.
- [x] 4.4 Issue a POS sale with quantity 12 and confirm FactuCore accepts it (sale `80003274-bee2-4084-92c8-62b211f3fd30`, invoice `SETP990010038` ACCEPTED).
