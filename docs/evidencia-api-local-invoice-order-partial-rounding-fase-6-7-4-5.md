# Evidencia API local invoice order partial rounding - Fase 6.7.4.5

## Alcance

QA local de absorcion de redondeo en ultima factura parcial para `inventory_invoice_order`.

No se ejecuto remoto.
No se toco PRD real.
No se hizo commit.

## Ambiente

DB local/copia QA:

```text
database: manus_tienda_prd
server_addr: ::1/128
server_port: 5432
```

API local usada para QA:

```text
http://localhost:4035/api
```

La API local fue detenida al final. Verificacion final: sin listener en `4035`.

## Migracion local

Se aplico V050 solo en DB local:

```text
ALTER TABLE
CREATE INDEX
CREATE FUNCTION
```

Precheck de efectos:

```text
inventory_invoice_order contiene v_use_rounding_absorption: true
idx_sale_items_tenant_order_item existe: true
chk_sale_items_subtotal_matches existe: false
```

## Fixture

Fixture controlado con tenant:

```text
67500000-0000-0000-0000-000000000001
```

Pedido creado con un `order_item`:

```text
ordered_quantity: 3.00
line_total: 100.00
tax_base: 84.03
tax_amount: 15.97
pricing_source esperado: ORDER_ITEM_SNAPSHOT
```

## Resultado DB

La validacion DB directa de tres facturas parciales usando `inventory_invoice_order` paso:

```text
lineTotals: 33.33, 33.33, 33.34
taxAmounts: 5.32, 5.32, 5.33
lineTotalSum: 100.00
taxAmountSum: 15.97
saleItemTaxesTaxAmountSum: 15.97
billedQuantity: 3.00
pricingSourceAllSnapshot: true
fixtureRowsRemaining: 0
```

Conclusion DB: la regla SQL de absorcion funciona y cierra contra el snapshot original.

## Resultado API

La API local pudo facturar parcial intermedia donde `subtotal = price * quantity`.

En la factura final absorbida, la operacion genera una linea con:

```text
price: 33.33
quantity: 1.00
subtotal: 33.34
```

La API devuelve `500` al construir la respuesta porque `SaleItemEntity` conserva la validacion legacy:

```text
subtotal must equal price multiplied by quantity
```

Stack local observado:

```text
SaleItemEntity
SaleService.mapSaleItem
SaleService.getSaleById
```

Interpretacion: V050 elimina el constraint SQL legacy, pero la capa de entidad API todavia aplica la misma regla en memoria. Por restriccion de esta QA no se modifico API TypeScript, `SaleService` ni `OrderService`.

## Cleanup

Cleanup ejecutado sobre fixture `67500000-*`.

Resultado final:

```text
fixtureRowsRemaining: 0
listener API 4035: no listener
```

## Validaciones

```text
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
valid: true
passed: 1
failed: 0

git diff --check
exitCode: 0
observacion: warning CRLF de Git en tasks.md, sin errores whitespace.
```

## Restricciones cumplidas

- No se modifico logica funcional.
- No se modifico SQL.
- No se modifico API TypeScript.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico POS.
- No se modifico frontend.
- No se modifico facturacion electronica.
- No se modifico DIAN.
- No se modifico suppliers.
- No se dejo API encendida.
- No se dejaron fixtures.
- No se ejecuto remoto.
- No se toco PRD real.
- No se hizo commit.

## Riesgo abierto

Para que el flujo API end-to-end quede verde, debe ajustarse la validacion legacy de `SaleItemEntity` que exige `subtotal = price * quantity`. Esa correccion queda fuera de esta QA por restriccion explicita.

## Seguimiento Fase 6.7.4.6

Se detecto que la BD ya crea correctamente la linea final absorbida:

```text
price: 33.33
quantity: 1
subtotal: 33.34
line_total: 33.34
pricing_source: ORDER_ITEM_SNAPSHOT
```

La Fase 6.7.4.6 corrige la compatibilidad de lectura API:

- `SaleItemEntity` permite subtotal absorbido solo cuando `pricingSource = ORDER_ITEM_SNAPSHOT`.
- `SaleItemEntity` mantiene validacion legacy para `pricingSource` nulo o legacy.
- `SaleService.getSaleById` lee y mapea `line_total` y `pricing_source`.
- No se modifica SQL ni `inventory_invoice_order`.

Validaciones de Fase 6.7.4.6:

```text
npx.cmd tsx --test src/modules/inventory/entities/sale-item.entity.spec.ts
tests: 5
pass: 5

npx.cmd tsx --test src/modules/inventory/services/sale.service.spec.ts
tests: 8
pass: 8

npm.cmd run build
status: pass

openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
valid: true
failed: 0

git diff --check
exitCode: 0
observacion: warning CRLF de Git, sin errores whitespace.
```

## QA API completa Fase 6.7.4.6

Se ejecuto QA API local completa sobre DB local/copia QA:

```text
api: http://127.0.0.1:4024/api
database: manus_tienda_prd
server_addr: ::1/128
server_port: 5432
inventory_invoice_order contiene absorcion: true
fixture UUID prefix: 67600000-*
sale type usado: CREDIT
```

Se uso `CREDIT` para aislar la validacion de redondeo y no mezclar pagos/caja en esta QA.
Un intento previo con `CASH` fallo por regla SQL esperada de cobertura completa de pagos, no por `SaleItemEntity`.

Resultado API:

```text
invoice 1:
  invoiceResponseOk: true
  getSaleByIdOk: true
  lineTotal: 33.33
  taxAmount: 5.32
  pricingSource: ORDER_ITEM_SNAPSHOT

invoice 2:
  invoiceResponseOk: true
  getSaleByIdOk: true
  lineTotal: 33.33
  taxAmount: 5.32
  pricingSource: ORDER_ITEM_SNAPSHOT

invoice 3:
  invoiceResponseOk: true
  getSaleByIdOk: true
  lineTotal: 33.34
  taxAmount: 5.33
  pricingSource: ORDER_ITEM_SNAPSHOT
```

Resultado DB:

```text
lineTotalSum: 100.00
taxAmountSum: 15.97
saleItemTaxesTaxAmountSum: 15.97
billedQuantity: 3.00
pricingSourceAllSnapshot: true
```

Cleanup:

```text
fixtureRowsRemaining: 0
listener API 4024: no listener
```

Conclusion API: la respuesta de `invoice` y `GET /api/sales/:id` ya no fallan por `SaleItemEntity` con subtotal absorbido.

Validaciones post-QA:

```text
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
valid: true
failed: 0

git diff --check
exitCode: 0
observacion: warning CRLF de Git, sin errores whitespace.
```
