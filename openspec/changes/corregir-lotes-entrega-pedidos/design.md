## Context

Evidencia (consulta de solo lectura en QA, 2026-11-13), salidas de `AGUADIENTE003` sin `stock_movement_lots`:

| Fecha | Cantidad | Pedido |
|---|---|---|
| 2026-11-12 00:35 | 5 | `44f9f7e3-…` |
| 2026-11-12 01:20 | 3 | `dea8026c-…` |
| 2026-11-12 17:58 | 2 | `35ba99b8-…` |
| 2026-11-12 17:59 | 2 | `35ba99b8-…` |
| 2026-11-12 19:06 | 3 | `001fb7fa-…` |

Total 15 = 110 (lotes) − 95 (kardex).

Reproducción controlada (propietario, 2026-11-13), producto nuevo `CEC01002003` (#12 THHN/THWN 90°C blanco CENTELSA), Sucursal Principal:

| Hora | Movimiento | Kardex | Lote vinculado |
|---|---|---|---|
| 12:38 | Compra +10 | 10 | CEC01002003-1 +10 |
| 12:40 | Venta POS −2 | 8 | CEC01002003-1 −2 |
| 12:43 | Ajuste salida −1 | 7 | CEC01002003-1 −1 |
| 12:44 | Ajuste entrada +2 | 9 | segundo lote +2 |
| 12:47 | Entrega de pedido `5335a75b-…` −2 | 7 | **ninguno** |
| 12:52 | Factura del pedido (venta `851a5976-…`) | 7 | sin movimiento (correcto) |

Kardex 7 (correcto si las 2 unidades salieron al cliente); lotes 7 + 2 = 9. La factura no mueve inventario; el defecto está solo en la entrega. Resultado esperado tras la corrección: la entrega consume FEFO (sin vencimiento, desempate por fecha de recepción) del lote CEC01002003-1, que queda en 5; lotes 5 + 2 = 7 = kardex.

Producto parecido: `AGUARDIENTE003` (`0379d93d-…`, inactivo desde su creación el 2026-09-21) con un lote de código "100" y 99 unidades. Es un caso de datos aparte (decisión del propietario).

## Goals / Non-Goals

**Goals:** entregas de productos con lote consumen lotes igual que el POS; kardex y lotes no vuelven a divergir por este flujo; corrección histórica controlada.

**Non-Goals:** elegir el lote manualmente al entregar (posible mejora posterior); cambiar el flujo de facturación del pedido; productos sin lote.

## Decisions

### D1. Consumo FEFO dentro de la transacción de entrega
Para cada producto con `requires_lot`:
1. Bloquear el alcance de stock con `inventory_lock_stock_scope(tenant, sucursal, producto)` (V108), en orden ascendente de `productId`, igual que `receivePurchase` y que el POS.
2. Leer saldos elegibles con `FOR UPDATE` usando la regla de `InventoryFefoService` (lote `ACTIVE`, vencimiento nulo o ≥ hoy, `quantity_available > 0`, orden por vencimiento y recepción).
3. Si la suma no alcanza, `BadRequestException("insufficient lot stock for delivery")` y rollback.
4. Crear el movimiento OUT (como hoy) y, por cada lote consumido, descontar el saldo con un `UPDATE` atómico (`quantity_on_hand - x`, solo si `quantity_available >= x`) e insertar el vínculo en `stock_movement_lots`, con el `client` de la transacción. Es la misma regla y la misma forma que `inventory_create_sale_v2`; no se reutilizan los servicios TS de saldos porque leen y sobrescriben el valor absoluto (riesgo de concurrencia descrito en `modernizar-inventario-lotes-ubicaciones`).

Alternativa descartada: delegar en la función SQL del POS; mezcla flujos y obliga a migración.

### D2. Validación de stock
Productos con lote: stock entregable = suma de lotes vendibles. Productos sin lote: kardex, como hoy (con el bloqueo de D1 para evitar sobregiro concurrente).

### D3. Corrección histórica (fuera de la implementación)
Script SQL idempotente, revisado y aprobado, ejecutado por el propietario según el runbook de migraciones:
1. Requisito previo: conteo físico de los lotes del producto en la sucursal.
2. Por cada salida sin vínculo, asignar lotes según el conteo (por defecto FEFO sobre los lotes vigentes con saldo: hoy `2026-002-00217703038061168`, vence 2027-06-30, 100 u → quedaría en 85).
3. Insertar `stock_movement_lots` y descontar `inventory_lot_balances`; no tocar `stock_movements`.
4. Verificar: conciliación sin `LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK` para el producto y suma de lotes = kardex (95).
Primero en QA; en PRD solo con la misma consulta de diagnóstico y aprobación.

### D4. Producto `AGUARDIENTE003` (inactivo, lote "100" con 99 u)
Opciones para el propietario: (a) si no existe físicamente, salida de ajuste con motivo y queda inactivo; (b) si existe y es el mismo producto, salida en `AGUARDIENTE003` y entrada en `AGUADIENTE003` con el lote real del fabricante. No se fusionan productos.

### D5. Protección de /pos
El cambio se limita a `OrderService.deliverOrder`. No se toca la función SQL `inventory_create_sale_v2`, `SaleService`, `sale.repository.ts`, `operational-sales` ni la web del POS. El bloqueo de producto de D1 solo dura la transacción de una entrega (milisegundos) y usa el mismo orden ascendente que la recepción de compras, para no crear bloqueos cruzados con ventas. La corrección de datos (D3) se ejecuta en una sola transacción corta, fuera del horario de ventas, y deja el disponible vendible igual al kardex (95), así que el POS sigue vendiendo lo mismo.

## Risks / Trade-offs

- Entregas que hoy pasan podrían rechazarse si los lotes vendibles no alcanzan (comportamiento correcto, pero visible para el usuario).
- La corrección histórica supone una asignación de lote; por eso exige conteo físico.

## Open Questions

1. ¿Se permite entregar desde un lote vencido con autorización (como el ajuste de salida), o se bloquea siempre?
2. ¿Anular o devolver una entrega debe restaurar lotes? Hoy no existe ese flujo para entregas; confirmar alcance.
