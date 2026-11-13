# Evidencia — corregir-lotes-entrega-pedidos

Estado: **cerrado** (2026-11-13). Mergeado a `develop` en el PR #397 (merge `59a9e2ea`, commit `596bcc63`).

## Diagnóstico

- `AGUADIENTE003`: 5 entregas de pedido del 2026-11-12 sin vínculo de lote (15 u) → kardex 95, lotes 110.
- Reproducción controlada `CEC01002003`: entrega de pedido −2 sin lote → kardex 7, lotes 9. La factura del pedido no mueve inventario.
- Causa: `OrderService.deliverOrder` registraba la salida sin consumir lotes ni bloquear.

## Corrección

- `deliverOrder` bloquea `inventory_lock_stock_scope` por producto (orden ascendente) y, para productos con lote, consume FEFO con la misma regla y SQL que la venta POS (`ACTIVE`, no vencido, `FOR UPDATE OF balance`, descuento atómico, `stock_movement_lots`).
- `OrderDeliverForm.tsx`: mensajes en español para stock de kardex y de lote insuficiente.
- Sin cambios en POS, ventas, esquema, migraciones ni permisos.

## Pruebas automáticas

| Prueba | Resultado |
|---|---|
| `openspec validate corregir-lotes-entrega-pedidos --strict` (Windows) | Válido |
| `order.service.spec.ts` (14 existentes + 5 nuevas) | 19/19 |
| Regresión POS sin modificar (`sale.service`, `sale.repository`, `sale-stock-rejection`) | 50/50 |
| API inventario + build (Windows, rama apilada) | 467/467, build OK |
| Web lint + build (Windows) | OK |
| Gobernanza | PASS, sin dueños ambiguos |

## QA manual (propietario)

| Caso | Resultado |
|---|---|
| 3.1 Ejercicio `CEC01002004`: compra en 2 lotes, venta POS, ajustes, entrega de pedido −2 vinculada al lote 1 por FEFO; lotes = kardex = 7; conciliación 0/0 | PASS |
| 3.2 Rechazo de entrega sin efectos (pedido de 10 con 5 disponibles) | PASS |
| 3.4 Regresión POS | PASS |
| Cierre con producto nuevo `CEC01002005`: Productos 7 = lotes 7; conciliación 0/0 | PASS |
| 3.3 Anulación de venta generada desde una entrega | Pospuesta por el propietario |

## Decisiones

- No se corrigen datos históricos (`CEC01002003`, `AGUADIENTE003`, duplicado inactivo `AGUARDIENTE003`). `correccion-datos-entregas-sin-lote.sql` queda solo como referencia.
