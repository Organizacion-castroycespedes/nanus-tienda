# Matriz de estados y transacciones — B5.3.3

| Área | Estados/reglas observados | Transacción/bloqueo | Garantía no demostrada |
|---|---|---|---|
| Producto | `ACTIVE`, `INACTIVE`, `BLOCKED`, `DISCONTINUED` | creación/actualización con `BEGIN` y rollback | sincronización con todos los consumidores |
| Lote | `ACTIVE`, `BLOCKED`, `CANCELLED`, `CONSUMED` usados por FEFO | operaciones dependen de servicio consumidor | transición uniforme de todos los flujos |
| Balance | disponible = on hand - reserved; reserva no supera disponible | repositorio recibe `PoolClient` cuando el consumidor lo entrega | bloqueo universal en cada ajuste |
| FEFO | fecha de vencimiento, recepción, código, id | selección de preview; consumo depende del flujo | FEFO en documentos que no llaman al servicio |
| Venta POS | snapshot de pricing, impuestos, promoción y lotes | `SaleService` y función SQL con transacción propia | misma ruta para pedido/venta operativa |
| Compra | recepción y movimientos | `PurchaseService` con `BEGIN`/`COMMIT`/`ROLLBACK`, `FOR UPDATE` | atomicidad con pagos externos |
| Pedido | snapshot de precios e impuestos en migraciones aplicables | `OrderService` tiene transacciones en operaciones concretas | equivalencia con POS |
| Promoción | activa, fecha, prioridad, objetivo por producto/sucursal | crear/actualizar reemplaza relaciones en una transacción | acumulación de promociones |

## Puntos de concurrencia

Se observaron `FOR UPDATE` en repositorios de productos, ventas y compras, y
transacciones explícitas en servicios de producto, compra, venta, ajustes y
promociones. `InventoryLotBalanceService` valida el saldo antes de decrementar
o reservar; el bloqueo final depende del repositorio y del `PoolClient` del
consumidor. Por eso el documento no afirma una garantía universal de
serialización para cada operación de inventario.

## Idempotencia

`V086__sale_creation_idempotency.sql` define una clave única por tenant para
creación de venta POS. Esa garantía pertenece a creación de ventas y no se
extiende a ajustes, FEFO, precios o promociones. No se documenta
`Idempotency-Key` universal para estos dominios.
