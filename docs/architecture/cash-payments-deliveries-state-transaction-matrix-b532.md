# Matriz de estados y transacciones: caja, pagos y domicilios — B5.3.2

| Proceso | Estados observados | Frontera transaccional | Bloqueo/constraint | Resultado incierto |
|---|---|---|---|---|
| Sesión de caja | `OPEN`, cierre con diferencia | `BEGIN`/`COMMIT`/`ROLLBACK` en apertura y cierre | sesión abierta por caja; asignación activa | requiere conciliación manual si se interrumpe |
| Movimiento de caja | creado | `BEGIN`/`COMMIT`/`ROLLBACK` | sesión debe estar `OPEN` | no se demuestra reintento automático |
| Pago | `PENDING`, `COMPLETED` y estados de operación | transacción propia o `PoolClient` de venta | documento y caja con `FOR UPDATE`; operaciones registradas | no se demuestra garantía exactly-once |
| Domicilio | `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO`, `CANCELADO` | creación, transición y asignación con rollback | fila de domicilio con `FOR UPDATE`; matriz de transición | reintento desde no entregado depende de `retryAllowed` |
| Sesión POS | ciclo propio de sesión de operador | transacción propia | separado de `cash_sessions` | desfase entre UI y backend no certificado |

## Transiciones de domicilio

| Acción | Origen permitido | Destino |
|---|---|---|
| `PREPARE` | `CREADO` | `EN_PREPARACION` |
| `DISPATCH` | `CREADO`, `EN_PREPARACION`, `NO_ENTREGADO` | `DESPACHADO` |
| `MARK_DELIVERED` | `DESPACHADO` | `ENTREGADO` |
| `MARK_NOT_DELIVERED` | `DESPACHADO` | `NO_ENTREGADO` |
| `CANCEL` | `CREADO`, `EN_PREPARACION` | `CANCELADO` |

Los estados finales no aceptan nuevas transiciones. Los nombres legacy se
normalizan por `deliveries.constants.ts`.

## Relación con B4 y B5.3.1

`createSale` de B4 puede incluir pagos dentro de la transacción de venta. Las
rutas financieras y de domicilios tienen fronteras propias. Una entrega puede
registrar contexto e impacto de caja, pero no se representa como parte de la
transacción PostgreSQL de impresión ni como factura fiscal aceptada.
