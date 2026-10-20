## Why

Las ventas POS de licores (ICL + ADV + IVA) se confirman y cobran bien, pero FactuCore rechaza la factura electronica con `El importe del impuesto N no coincide con base por tarifa y redondeo DIAN.`

Caso real: venta `1709ad74-fdd1-4af2-8b71-ca2110df490b`, producto `WHISKY BUCHANANS DE LUXE 1000` (40 grados, 1000 ml, DANE 229238). Manus guarda ICL `19200.00` (tarifa 360 por 750 ml), ADV `57309.50` e IVA `7272.79`; suma 229238. El mapper `FactuCoreMapper.mapTax` recalcula todo impuesto como porcentaje: la tarifa especifica ICL `360` se usa como 360% de la base `53.33` y se envia `191.99`. FactuCore reconstruye el ICL legal (`53.333... x 360 = 19200`) y rechaza.

Ademas `calculateFactuCoreLineTotal` calcula el pago como `base de linea x cada tarifa`, lo que deja el pago fuera del total del documento en cuanto el ICL pase.

En lineas con cantidad mayor a 1, `normalizeElectronicBillingTaxForQuantity` (api) duplicaba ICL y ADV: tomaba `base x tarifa = importe` como prueba de snapshot por unidad, pero esa igualdad se cumple tambien para snapshots de linea. Caso real: venta `7edcf37f-cfa6-48dd-bd2c-766695cbd116` (Tapa Roja x2) rechazada localmente con `Sale total does not match snapshot totals`.

Ocho licores tenian `price_without_tax` que no reconstruia `price_with_tax` con ICL + ADV + IVA; la factura sumaba distinto al cobro.

## What Changes

- `mapTax` conserva tarifa e importe de impuestos especificos por unidad (ICL `32`) tal como los calcula pricing; no los pasa por la formula porcentual.
- Impuestos porcentuales (IVA, ADV, INC) siguen normalizando la tarifa fraccion a puntos DIAN (`0.05 -> 5`) y recalculando el importe con redondeo DIAN sobre su propia base.
- El total de linea usado para el pago es base de linea + suma de importes de impuestos ya mapeados.
- Prueba unitaria con el payload real del whisky.
- `normalizeElectronicBillingTaxForQuantity` solo escala ICL/ADV por cantidad cuando el perfil del producto (grados, volumen, precio DANE) prueba que el snapshot es por unidad.
- Migracion `V100__realign_liquor_fiscal_base_price.sql`: recalcula `price`/`price_without_tax` de licores cuya suma no reconstruye `price_with_tax`. No cambia el precio de gondola.

## Capabilities

### New Capabilities
- `factucore-liquor-tax-mapping`: Contrato de mapeo de impuestos de licores (ICL, ADV, IVA) hacia FactuCore.

### Modified Capabilities
- Ninguna.

## Impact

- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.mapper.ts`
- `backend-facturacion-electronica/test/factucore.provider.spec.ts`
- `api/src/modules/inventory/services/sale.service.ts` y su spec.
- `scripts/database/migrations/V100__realign_liquor_fiscal_base_price.sql`.
- Sin cambios en `web` ni contratos de eventos.
