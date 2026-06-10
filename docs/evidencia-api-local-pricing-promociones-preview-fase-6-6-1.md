# Evidencia API local pricing promociones preview - Fase 6.6.1

## Decision final

FASE 6.6.1 APROBADA.

`POST /api/pricing/preview-line` calcula promociones reales desde DB local, recalcula impuestos sobre el precio final y no persiste ventas, pedidos ni cambios en producto.

## Ambiente usado

- DB_HOST: `localhost`
- DB_PORT: `5432`
- DB_NAME: `manus_tienda_prd`
- API local: `http://localhost:4024/api`
- PostgreSQL: `PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit`
- Servidor DB reportado: `::1/128:5432`
- Confirmacion: copia QA local de PRD, no PRD real.
- Token local usado en runtime, no expuesto.

## Backup

Backup local previo:

`D:\Profe\backups\manus_tienda_prd_pricing_promos_preview_pre_20260601_120304.dump`

Backup fuera del repo. No se exponen secretos.

## Datos fixture

Prefijo:

`QA_PRICE_PROMO_661_1780334692371_`

Producto fixture:

- `productId`: `58420362-48f4-4a95-b1bf-9185ea1895b8`
- `sku`: `QA_PRICE_PROMO_661_1780334692371_SKU`
- `price`: `119`
- `price_without_tax`: `100`
- `taxId`: `20000000-0000-0000-0000-000000000001`
- `taxRate`: `0.19`
- `branchId`: `dc1b81e0-5ea9-4972-839c-2eb158112e40`
- `otherBranchId`: `ab41d3da-6686-4de3-9191-875a5a7da5a5`

Promociones creadas:

- `PERCENTAGE`: 10%, activa.
- `FIXED_AMOUNT`: 19, activa.
- `SPECIAL_PRICE`: 59.5, activa.
- `EXPIRED`: vencida.
- `INACTIVE`: inactiva.
- `OTHER_BRANCH`: activa, pero limitada a otra sucursal.
- `PRIORITY_LOW`: 5%, `priority=1`.
- `PRIORITY_HIGH`: 50%, `priority=5`.
- `TIE_SMALL`: 10%, `priority=3`.
- `TIE_BIG`: 20 fijo, `priority=3`.
- `NEGATIVE_GUARD`: 500 fijo, para validar limite de precio final.

## Payload sanitizado

Ejemplo:

```json
{
  "tenantId": "<ignored-from-body>",
  "branchId": "<branchId>",
  "productId": "<productId>",
  "quantity": 2,
  "channel": "POS",
  "date": "2026-06-10T12:00:00.000Z"
}
```

El tenant real viene del token autenticado, no del body.

## Resultado sin promocion

Fecha: `2026-06-09T12:00:00.000Z`

Resultado:

- `baseUnitPrice`: 119
- `finalUnitPrice`: 119
- `discountAmount`: 0
- `discountPercent`: 0
- `appliedPromotionId`: null
- `taxBase`: 200
- `taxAmount`: 38
- `lineTotal`: 238

Comportamiento base conservado.

## Resultado PERCENTAGE

Fecha: `2026-06-10T12:00:00.000Z`

Resultado:

- `discountAmount`: 11.9
- `discountPercent`: 10
- `finalUnitPrice`: 107.1
- `taxBase`: 180
- `taxAmount`: 34.2
- `lineTotal`: 214.2
- `appliedPromotionName`: `QA_PRICE_PROMO_661_1780334692371_PERCENTAGE`

## Resultado FIXED_AMOUNT

Fecha: `2026-06-11T12:00:00.000Z`

Resultado:

- `discountAmount`: 19
- `discountPercent`: 15.97
- `finalUnitPrice`: 100
- `taxBase`: 168.06
- `taxAmount`: 31.94
- `lineTotal`: 200
- `appliedPromotionName`: `QA_PRICE_PROMO_661_1780334692371_FIXED_AMOUNT`

Nota de redondeo: el servicio redondea el precio unitario sin impuesto antes de multiplicar por cantidad. Por eso `taxBase=168.06`, no `168.07`.

## Resultado SPECIAL_PRICE

Fecha: `2026-06-12T12:00:00.000Z`

Resultado:

- `discountAmount`: 59.5
- `discountPercent`: 50
- `finalUnitPrice`: 59.5
- `taxBase`: 100
- `taxAmount`: 19
- `lineTotal`: 119
- `appliedPromotionName`: `QA_PRICE_PROMO_661_1780334692371_SPECIAL_PRICE`

## Vencida, inactiva y otra sucursal

Promocion vencida:

- fecha: `2026-06-13T12:00:00.000Z`
- `discountAmount`: 0
- `appliedPromotionId`: null
- `lineTotal`: 238

Promocion inactiva:

- fecha: `2026-06-14T12:00:00.000Z`
- `discountAmount`: 0
- `appliedPromotionId`: null
- `lineTotal`: 238

Promocion de otra sucursal:

- fecha: `2026-06-15T12:00:00.000Z`
- request usa `branchId` principal.
- promocion estaba asociada a `otherBranchId`.
- `discountAmount`: 0
- `appliedPromotionId`: null
- `lineTotal`: 238

## Prioridad

Fecha: `2026-06-16T12:00:00.000Z`

Promociones:

- `PRIORITY_LOW`: 5%, `priority=1`
- `PRIORITY_HIGH`: 50%, `priority=5`

Resultado:

- gana `PRIORITY_LOW`.
- `discountAmount`: 5.95
- `discountPercent`: 5
- `finalUnitPrice`: 113.05
- `lineTotal`: 226.1

El criterio de menor `priority` gana aunque otra promocion dé mayor descuento.

## Empate de prioridad

Fecha: `2026-06-17T12:00:00.000Z`

Promociones:

- `TIE_SMALL`: 10%, `priority=3`
- `TIE_BIG`: 20 fijo, `priority=3`

Resultado:

- gana `TIE_BIG`.
- `discountAmount`: 20
- `finalUnitPrice`: 99
- `lineTotal`: 198

El empate de prioridad gana por mayor descuento.

## Edge case: precio final no negativo

Fecha: `2026-06-18T12:00:00.000Z`

Promocion:

- `NEGATIVE_GUARD`: descuento fijo `500`
- producto base: `119`
- quantity: `3`

Resultado:

- `discountAmount`: 119
- `discountPercent`: 100
- `finalUnitPrice`: 0
- `taxBase`: 0
- `taxAmount`: 0
- `lineTotal`: 0

El descuento se limita al precio base unitario.

## Validacion impuestos

El producto fixture usa IVA incluido:

- `baseUnitPrice`: 119
- `taxRate`: 0.19
- precio sin impuesto base: 100

Se valido que `taxBase` y `taxAmount` se recalculan sobre `finalUnitPrice`:

- porcentaje 10%: `finalUnitPrice=107.1`, `taxBase=180`, `taxAmount=34.2`
- fijo 19: `finalUnitPrice=100`, `taxBase=168.06`, `taxAmount=31.94`
- precio especial 59.5: `taxBase=100`, `taxAmount=19`

## No persistencia

Conteos antes:

- `products`: 6
- `sale_items`: 49
- `order_items`: 22
- `promotions`: 0

Durante fixture:

- `products`: 7 por producto temporal.
- `sale_items`: 49, sin cambios.
- `order_items`: 22, sin cambios.

Despues de cleanup:

- `products`: 6
- `sale_items`: 49
- `order_items`: 22
- `promotions`: 0

Confirmacion:

- No se crearon ventas.
- No se crearon pedidos.
- No se modificaron `sale_items`.
- No se modificaron `order_items`.
- No se modifico POS.
- No se modifico Orders.
- No se modifico `inventory_create_sale_v2`.

## Cleanup

Fixtures antes de cleanup:

- promociones: 11
- productos: 1

Fixtures despues de cleanup:

- promociones: 0
- productos: 0

`fixture_rows_remaining=0`

## Bugs encontrados/corregidos

No hubo bug funcional de backend.

Hubo un ajuste en el script de validacion: la expectativa manual de `taxBase` para `FIXED_AMOUNT` se corrigio de `168.07` a `168.06` porque el servicio redondea el valor unitario sin impuesto antes de multiplicar por cantidad. No se modifico codigo funcional.

## Comandos ejecutados

Sin secretos:

```powershell
pg_dump --format custom --file D:\Profe\backups\manus_tienda_prd_pricing_promos_preview_pre_20260601_120304.dump
cd api
npm.cmd run start:dev
node <script-local-temporal-pricing-preview>
```

## Riesgos vivos

- Falta integrar primero en Orders de forma controlada.
- Falta decidir persistencia de descuento aplicado en `order_items` y luego `sale_items`.
- Falta prueba UI cuando frontend consuma pricing preview.

## Proximos pasos

- Disenar integracion inicial de Orders con `PricingService`.
- Mantener POS sin cambios hasta fase propia.
- Definir auditoria de promocion aplicada al confirmar documentos operativos.
