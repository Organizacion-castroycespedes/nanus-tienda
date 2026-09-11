# Evidencia FASE 8 - Sale / Electronic Invoice Integration

## Scope

- Hooked `SaleService.createSale()` into the neutral electronic billing domain.
- Sale now builds a canonical invoice command from the sale snapshot.
- No FactuCore HTTP in sale flow.
- No change to `V072`.

## Transaction strategy

- Selected: `SAME DB TRANSACTION`.
- Sale commit waits for internal electronic document aggregate creation.
- Provider HTTP still happens later in background processing.

## Behavior

- If electronic billing is disabled for the tenant, sale continues normal.
- If tenant has enabled electronic billing but no default config, sale fails.
- If enabled config exists and electronic billing intent fails, sale rolls back.

## Snapshot mapping

- Customer snapshot comes from `customers` plus fiscal lookup when available.
- Line snapshot uses priced sale items, product data, and tax lookup.
- Payment mapping supports one payment or mixed payment metadata.
- `externalReference` is deterministic: `SALE-<tenantId>-<saleId>`.
- `source_type` and `source_id` are set to `SALE` and the sale id.

## Files

- `api/src/modules/inventory/services/sale.service.ts`
- `api/src/modules/inventory/mappers/sale-electronic-invoice.mapper.ts`
- `api/src/modules/electronic-billing/electronic-billing.service.ts`
- `api/src/modules/electronic-billing/electronic-billing.service.spec.ts`
- `api/src/modules/inventory/services/sale.service.spec.ts`
- `api/src/modules/electronic-invoicing/electronic-invoicing.module.ts`
- `api/src/modules/inventory/inventory.module.ts`

## Tests

- `api` build: PASS
- Focused tests:
  - `api/src/modules/electronic-billing/electronic-billing.service.spec.ts`
  - `api/src/modules/inventory/services/sale.service.spec.ts`

## Remaining gap

- `createSaleFromOrderDelivery()` still does not create an electronic invoice intent in this phase.
- `CREDENTIAL STORAGE` remains pending for real provider E2E.
