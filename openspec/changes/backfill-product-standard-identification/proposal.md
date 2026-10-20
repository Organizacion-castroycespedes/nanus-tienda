## Why

FactuCore rechaza toda factura cuya linea no tenga identificacion estandar DIAN (`cac:StandardItemIdentification`): `PRODUCT_MASTER_DATA_GAP: la factura requiere una identificacion estandar DIAN verificada.` El rechazo es terminal; la venta queda sin factura.

Caso real: venta `3a18a73d-6ffa-41d9-8f2f-2ebd91734bcf` (cerveza x12, aguardiente x3, whisky x2). Montos e impuestos pasaron; lineas sin `standardItemId` fueron rechazadas.

En QA 20 productos activos (cervezas, aguardientes, rones, whiskies, pollo) tienen `dian_standard_item_scheme_id` y `dian_standard_item_code` en NULL. El formulario de producto ya define la regla: esquema `999` (codigo adoptado por el contribuyente) inicia con el SKU; 138 de 143 productos `999` usan exactamente su SKU.

## What Changes

- Migracion `V102__backfill_product_standard_identification.sql`: para productos sin esquema ni codigo y con SKU valido, fija esquema `999` y codigo = SKU.
- No toca productos que ya tienen identificacion (GTIN `010`, `999` u otros).
- Idempotente.

## Capabilities

### New Capabilities
- `product-standard-identification-backfill`: todo producto con SKU tiene identificacion estandar DIAN para facturar.

### Modified Capabilities
- Ninguna.

## Impact

- `scripts/database/migrations/V102__backfill_product_standard_identification.sql`.
- Sin cambios de codigo, contratos ni `web`.
- Ventas ya rechazadas no se recuperan; las nuevas ventas de esos productos se facturan.
