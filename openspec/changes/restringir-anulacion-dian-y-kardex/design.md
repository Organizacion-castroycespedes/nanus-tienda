## Context

La venta POS normal usa `inventory_create_sale_v2` y persiste un `stock_movements OUT` por línea. La función calcula el saldo agregado por `tenant_id`, `branch_id` y `product_id`, guarda `stock_before` y `ROUND(stock_before - quantity, 3)`, y para productos loteados bloquea filas de `inventory_lot_balances` con `FOR UPDATE`.

`OperationalSalesService.applySaleVoid` ya bloquea la fila de `sales`, busca los `OUT` de esa venta y revierte lotes dentro de la misma transacción, pero inserta el `IN` manualmente sin snapshots. La misma venta queda protegida contra doble aplicación por `FOR UPDATE` y estados `CANCELLED`/`REFUNDED`; no se debe cambiar ese flujo.

FactuCore ya recibe `discrepancyResponseCode` desde el contrato de nota crédito. El código 2 es el valor por defecto y corresponde al caso de anulación total. No se necesita cambiar FactuCore.

## Goals / Non-Goals

**Goals:**

- Permitir solo el motivo DIAN `"2"` en la anulación total de una factura electrónica.
- Quitar del modal las opciones 1, 3, 4 y 5 y conservar el payload `2`.
- Reutilizar `StockMovementService.createMovement` para que el `IN` de reversión tenga snapshots de stock y alcance por tenant/sucursal.
- Mantener lotes, pagos, caja, transacción, estados fiscales e idempotencia existentes.

**Non-Goals:**

- No cambiar motivos de otros flujos de notas crédito.
- No cambiar el contrato ni el proveedor FactuCore.
- No agregar migraciones ni crear una nueva fuente de stock.
- No resolver una política nueva de productos no inventariables.

## Decisions

1. **Constreñir el DTO y el servicio.** `VoidOperationalSaleDto` usará `@IsIn(["2"])`; `voidSale` también rechazará defensivamente cualquier valor distinto de `2`, porque los tests o llamadas internas pueden invocar el servicio sin el pipe de validación. Esto no toca `OperationalDebitNoteDto`.

2. **Modal de una sola opción.** Se conservará la constante con solo el objeto de código 2 y el estado inicial `"2"`. El payload seguirá enviando descripción y código para factura aceptada.

3. **Reversión por `StockMovementService`.** `applySaleVoid` inyectará el servicio existente y llamará `createMovement(..., client)`. Ese servicio calcula el saldo actual por tenant/sucursal, aplica `IN = +quantity`, valida el producto del tenant y persiste `stock_before`/`stock_after`. Se mantiene el `reverseMovement.id` para los enlaces de lote.

4. **Una reversión por movimiento OUT.** Se conserva la consulta de `OUT` originales y el `FOR UPDATE` de `sales`; no se sumará otra devolución por `sale_items`, evitando duplicar productos cuando hay múltiples movimientos del mismo producto.

## Risks / Trade-offs

- [Riesgo] El cálculo agregado de `StockMovementService` usa una consulta de saldo y luego inserta; movimientos concurrentes del mismo producto pueden producir snapshots no estrictamente serializados. → Mitigación: conservar la transacción, el lock de la venta y el lock de balances de lote existente; dejar una prueba/pendiente explícita para serialización de stock general.
- [Riesgo] `Number()` representa NUMERIC en JavaScript. → Mitigación: conservar las cantidades persistidas y el redondeo/escala actual; no alterar el esquema `NUMERIC(14,3)`.
- [Riesgo] Una solicitud ya pendiente ante DIAN puede reintentarse. → Mitigación: solo aplicar inventario cuando la nota está `ACCEPTED`, y la fila de venta bloqueada impide doble reversión.

## Migration Plan

No hay migración. Desplegar API y web juntos. Si se revierte el código, no se eliminan movimientos históricos; se conserva el Kardex ya escrito.

## Open Questions

- Confirmar en ambiente de integración que FactuCore/Dian acepta `discrepancyResponseCode = "2"` con la descripción actual. El contrato local y el valor por defecto ya lo sustentan; la aceptación remota queda PENDING hasta prueba real.
