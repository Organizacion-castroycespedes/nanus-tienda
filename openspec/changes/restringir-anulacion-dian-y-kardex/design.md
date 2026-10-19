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
- No agregar migraciones distintas de V108 ni crear una nueva fuente de stock.
- No resolver una política nueva de productos no inventariables.

## Decisions

1. **Constreñir el DTO y el servicio.** `VoidOperationalSaleDto` usará `@IsIn(["2"])`; `voidSale` también rechazará defensivamente cualquier valor distinto de `2`, porque los tests o llamadas internas pueden invocar el servicio sin el pipe de validación. Esto no toca `OperationalDebitNoteDto`.

2. **Modal de una sola opción.** Se conservará la constante con solo el objeto de código 2 y el estado inicial `"2"`. El payload seguirá enviando descripción y código para factura aceptada.

3. **Reversión por `StockMovementService` y protocolo común.** `applySaleVoid` ya llama `createMovement(..., client)`, pero eso no basta para concurrencia: el servicio y `inventory_create_sale_v2` deben adquirir el mismo lock por `(tenant_id, branch_id, product_id)` antes de leer el saldo. El lock debe adquirirse en orden estable para todos los productos de una operación multiítem y conservarse hasta el `INSERT`/validación. No se debe declarar lista la corrección hasta probar que todos los escritores runtime relevantes usan el mismo protocolo.

4. **Guardia en la base.** La migración forward-only V108 agrega `inventory_lock_stock_scope` y un trigger `BEFORE INSERT` sobre `stock_movements`. El trigger vuelve a calcular y persiste los snapshots bajo el lock, y rechaza un `OUT` que dejaría saldo negativo. La función activa de venta se reescribe en V108 para tomar locks de todos sus productos en orden determinístico antes de insertar la venta; así el protocolo también cubre escritores SQL directos.

5. **Aplicación local gobernada.** El runner oficial acepta `MIGRATION_TARGET_ENV=LOCAL` solo con `ENVIRONMENT=local`, `127.0.0.1:5432`, base `manus_tienda_qa`, esquema `public` y usuario efectivo `postgres`. La identidad efectiva se verifica antes del DDL. V107 y V108 se ejecutan y registran en orden, en la misma transacción que cada fila de `migrations_history`.

6. **Una reversión por movimiento OUT.** Se conserva la consulta de `OUT` originales y el `FOR UPDATE` de `sales`; no se sumará otra devolución por `sale_items`, evitando duplicar productos cuando hay múltiples movimientos del mismo producto.

## Risks / Trade-offs

- [Riesgo] El cálculo agregado de `StockMovementService` y `inventory_create_sale_v2` usa `SUM` sin lock común antes de leer; movimientos concurrentes pueden producir snapshots iguales o permitir sobreventa. → Mitigación requerida: lock común por tenant/sucursal/producto, orden estable multiítem y prueba PostgreSQL aislada con dos transacciones.
- [Riesgo] El repositorio conserva una función histórica en `products/2026_09_12_vps_tax_model_alcohol_bundle.sql` y una versión incremental en `V104`; aplicar una corrección solo en una fuente puede dejar runtime divergente. → Mitigación: confirmar `migrations_history` en una base aislada y actualizar solo la fuente autoritativa mediante nueva migración forward-only.
- [Riesgo] `Number()` representa NUMERIC en JavaScript. → Mitigación: conservar las cantidades persistidas y el redondeo/escala actual; no alterar el esquema `NUMERIC(14,3)`.
- [Riesgo] Una solicitud ya pendiente ante DIAN puede reintentarse. → Mitigación: solo aplicar inventario cuando la nota está `ACCEPTED`, y la fila de venta bloqueada impide doble reversión.

## Migration Plan

Aplicar primero V107 y después `V108__serialize_stock_movement_snapshots.sql` mediante `apply_single_migration.sh`. V108 es idempotente para reconciliar objetos ya aplicados manualmente en la copia local, pero su ejecución y el registro de historial deben ocurrir juntos. No alterar checksums históricos de V105 electrónica ni V106. Si se revierte el código, no se eliminan movimientos históricos; se conserva el Kardex ya escrito.

## Open Questions

- Confirmar en ambiente de integración que FactuCore/Dian acepta `discrepancyResponseCode = "2"` con la descripción actual. El contrato local y el valor por defecto ya lo sustentan; la aceptación remota queda PENDING hasta prueba real.
