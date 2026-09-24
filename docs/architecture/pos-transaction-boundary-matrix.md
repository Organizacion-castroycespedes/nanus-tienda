# Matriz de límites transaccionales POS — B4.1

| Fase | Operación | ¿Mismo `PoolClient`? | Commit/rollback | Estado |
|---|---|---:|---|---|
| Entrada | Guards, tenant, sucursal, terminal, caja y sesión POS | No aplica antes de conexión | Rechazo sin escritura de venta | Confirmado |
| Reserva | `sale_creation_idempotency` y hash | Sí | Rollback si hash difiere o falla validación | Confirmado |
| Precio | `PricingService.calculateLinePrice` | Ejecutado antes de persistencia principal | Error aborta la transacción | Confirmado por servicio; llamada de cálculo no es SQL en sí |
| Venta | `inventory_create_sale_v2` | Sí | Inserta venta/líneas, stock y lotes; excepción revierte | Confirmado |
| Pagos | `PaymentsService.createInTransaction` | Sí | Pago, asignación y caja revierten con venta | Confirmado |
| Finalización | Estado financiero y venta | Sí | Se actualiza antes de commit | Confirmado |
| Outbox | `enqueueSaleCompletedEvent(event, client)` | Sí cuando política automática aplica | Fallo aborta esa ruta antes de commit | Confirmado condicional |
| Idempotencia | Completar `sale_id` y `completed_at` | Sí | Se confirma junto con venta | Confirmado |
| Auditoría | `SALE_CREATED` | No: después de commit | Fallo posterior no deshace venta | Confirmado |
| Respuesta Web | Limpieza de carrito y periféricos | No: cliente posterior | No pertenece al commit de base de datos | Confirmado como comportamiento Web |

## Alcance de atomicidad

La afirmación fuerte permitida es: la ruta `createSale` directa agrupa venta,
inventario SQL, pagos, finalización, outbox automático e idempotencia cuando usa
el mismo `PoolClient` y llega a `COMMIT`. No se extiende a reportería, DIAN,
impresión, cajón, periféricos, auditoría posterior ni a otros endpoints.

`createSaleFromOrderDelivery` es otra transacción. La consulta del carrito Web,
la vista previa de precio y la reconciliación posterior son operaciones separadas.
