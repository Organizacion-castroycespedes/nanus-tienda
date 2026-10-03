## Why

Con cantidades mayores a 1 la factura electronica no suma lo cobrado. Pricing calcula la base fiscal por unidad, la redondea y la multiplica por la cantidad; el IVA queda como residuo (`cobro - base`). La facturacion recalcula el IVA como `round(base x tarifa)` y el total ya no es el cobro.

Caso real (simulacion de 300 productos): `Agua cristal 300ml` x12 a `$1000`. Pricing: base `840.34 x 12 = 10084.08`, IVA residuo `1915.92`. Factura: IVA `round(10084.08 x 0.19) = 1915.98`, total `12000.06` contra `12000` cobrados. Con cantidad 12, 103 lineas superan la tolerancia `0.05` y Manus rechaza la factura con `Sale total does not match snapshot totals`.

Ademas `unitPrice` viaja con 2 decimales (`roundCurrency(base / qty)`) y la columna `electronic_document_lines.unit_price` es `NUMERIC(18,2)`: aunque la base de linea sea correcta, `unitPrice x qty` no la reconstruye. El Anexo Tecnico DIAN 1.9 permite `cbc:PriceAmount` con hasta 6 decimales (FBB02) y exige `LineExtensionAmount = PriceAmount x BaseQuantity` (FAV06).

## What Changes

- Pricing calcula la base del impuesto porcentual a nivel de linea desde lo cobrado: `base + round(base x tarifa) = cobro - otros impuestos de la linea`. El IVA es `round(base x tarifa)`, no residuo. Aplica a precio con impuesto incluido, a precio de cliente separado (`price_with_tax != price_without_tax`) y a la parte IVA de licores con precio separado o IVA incluido.
- Si ningun centavo cierra exacto (saltos de redondeo), se toma la base con menor diferencia (maximo `0.01`).
- La rama legacy de `buildElectronicBillingLines` (sin snapshot de impuestos) usa la misma regla.
- `unitPrice` del snapshot de facturacion viaja con 6 decimales (`base de linea / cantidad`).
- Migracion `V101__electronic_document_lines_unit_price_6_decimals.sql`: `unit_price` pasa a `NUMERIC(18,6)`.
- FactuCore (repo externo) escribe `cbc:PriceAmount` con `formatDianUnitAmount` (6 decimales). Su DTO y su tabla ya aceptan 6 decimales.
- El cliente paga lo mismo; solo cambia como se reparte base e IVA dentro de la linea.

## Capabilities

### New Capabilities
- `invoice-line-base-rounding`: base fiscal de linea derivada del cobro y precio unitario con 6 decimales hacia la factura electronica.

### Modified Capabilities
- Ninguna.

## Impact

- `api/src/modules/pricing/pricing.service.ts` y su spec.
- `api/src/modules/inventory/services/sale.service.ts` y su spec.
- `scripts/database/migrations/V101__electronic_document_lines_unit_price_6_decimals.sql`.
- `Factucore/backend/src/modules/xml-generator/dian-ubl-generator.service.ts` (repo externo).
- Sin cambios en `web` ni en contratos de eventos (`unitPrice` ya es string decimal).
- Fuera de alcance: la cerveza usa el impuesto al consumo de cerveza como impuesto puente y pricing no agrega el IVA 19%; requiere decision fiscal aparte.
