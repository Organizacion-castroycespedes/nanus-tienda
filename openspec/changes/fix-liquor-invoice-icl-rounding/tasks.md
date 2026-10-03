## 1. Mapper

- [x] 1.1 `mapTax` keeps rate and amount for ICL (scheme `32`).
- [x] 1.2 `calculateFactuCoreLineTotal` sums mapped tax amounts.

## 2. Sale billing snapshot

- [x] 2.1 `normalizeElectronicBillingTaxForQuantity` scales ICL/ADV only when the product profile proves a unit snapshot.
- [x] 2.2 `buildElectronicBillingLines` passes the expected line base from degree/volume or DANE price.

## 3. Tests

- [x] 3.1 Add whisky test (ICL 19200, ADV 57309.50, IVA 7272.79, payment 229238) to `backend-facturacion-electronica/test/factucore.provider.spec.ts`.
- [x] 3.2 Add quantity tests (line snapshot kept, unit snapshot scaled) to `api/src/modules/inventory/services/sale.service.spec.ts`.
- [x] 3.3 Run `backend-facturacion-electronica` and api sale/pricing suites.

## 4. Data and end to end

- [x] 4.1 Audit liquor products and add `V100__realign_liquor_fiscal_base_price.sql` for rows that do not rebuild.
- [x] 4.2 Rebuild `api` and `facturacion` containers.
- [x] 4.3 Issue liquor POS sales and confirm FactuCore accepts the invoices (sale `7edcf37f-cfa6-48dd-bd2c-766695cbd116`, invoice `SETP990010037` ACCEPTED).
