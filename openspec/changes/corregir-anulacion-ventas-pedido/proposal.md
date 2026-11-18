## Why

Al anular una venta que viene de un pedido no vuelve el inventario (SETP990900026 y SETP990900028 en QA local). La salida de esas ventas se crea al entregar el pedido y queda a nombre del pedido (`reference_table = 'orders'`); facturar el pedido crea la venta sin movimientos. La anulacion (`applySaleVoid`) solo busca salidas a nombre de la venta (`reference_table = 'sales'`), no encuentra ninguna y no devuelve nada. Las series entregadas en un pedido tampoco vuelven, porque `prc_product_serials_mark_returned` busca por `sale_id`. Las ventas del POS se anulan correctamente.

## What Changes

- `OperationalSalesService.applySaleVoid`: rama nueva solo para ventas con `order_id` y sin salidas propias. Devuelve por producto fisico la cantidad facturada en la venta (los servicios no generan movimiento), sin superar lo entregado menos lo ya devuelto por otras anulaciones del mismo pedido. La entrada queda a nombre de la venta (`reference_table = 'sales'`) en la sucursal de la entrega. Si la entrega consumio lotes, el saldo vuelve a esos lotes (salida mas reciente primero), descontando lo ya devuelto.
- Reembolso (decision del propietario, opcion A): si la venta de pedido no tiene pagos propios, se reembolsan en caja los pagos del pedido (`SALES_ORDER`, IN, COMPLETED), el mas reciente primero, hasta el total de la venta y descontando lo ya reembolsado por anulaciones de otras ventas del mismo pedido. Se crea el pago `REFUND` (OUT) en el turno abierto y su movimiento de caja, como en el POS. El pago del pedido queda REFUNDED solo si se devuelve completo. La venta queda REFUNDED ("Devuelta") si hubo reembolso; si no, CANCELLED.
- V119: `prc_product_serials_mark_returned_order_sale` marca RETURNED (o registra VOIDED_NOT_RETURNED) las series SOLD del pedido, por producto y cantidad.
- El flujo de anulacion de ventas del POS no cambia: si la venta tiene salidas propias, sigue el codigo existente y no se consulta el pedido.

## Impact

- API: `operational-sales.service.ts` (+ spec nueva), `product-serial.repository.ts`, `product-serial.service.ts`.
- Migracion V119 (solo crea una funcion). Local: `Claude outputs/aplicar-V119-local.cjs`; QA/PRD: runner oficial.
- Las anulaciones ya hechas no se corrigen solas: requieren ajuste de inventario manual.
- Fuera de alcance: revertir el estado del pedido ni sus cantidades entregadas/facturadas al anular (el pedido sigue como pagado/completado; el reembolso queda como pago REFUND de la venta).
