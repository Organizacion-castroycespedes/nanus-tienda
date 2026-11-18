## ADDED Requirements

### Requirement: Devolucion de inventario al anular ventas de pedido

Al anular con devolucion de inventario una venta que viene de un pedido y no tiene salidas propias, el sistema SHALL crear una entrada por cada producto fisico facturado, por la cantidad de la venta, sin superar lo entregado menos lo ya devuelto por otras anulaciones del mismo pedido. Los productos no inventariables MUST NOT generar movimientos.

#### Scenario: Venta de pedido anulada con devolucion

- **WHEN** se anula con devolucion una venta de pedido con 1.5 de cable y un servicio
- **THEN** el sistema SHALL crear una entrada de 1.5 del cable a nombre de la venta y ninguna para el servicio.

#### Scenario: Venta de pedido anulada sin devolucion

- **WHEN** se anula una venta de pedido sin devolver inventario
- **THEN** el sistema MUST NOT crear entradas.

#### Scenario: Producto con lote

- **WHEN** la entrega del pedido consumio lotes
- **THEN** el saldo SHALL volver a esos lotes, de la salida mas reciente a la mas antigua, descontando lo ya devuelto.

### Requirement: Series de ventas de pedido

Al anular una venta de pedido, el sistema SHALL marcar como RETURNED las series vendidas del pedido para los productos y cantidades de la venta cuando se devuelve el inventario, o registrar VOIDED_NOT_RETURNED cuando no.

#### Scenario: Serie entregada en pedido

- **WHEN** se anula con devolucion una venta de pedido con un producto con serie
- **THEN** la serie SHALL quedar RETURNED con evento de anulacion.

### Requirement: Reembolso de pagos de pedido al anular su venta

Al anular una venta de pedido sin pagos propios, el sistema SHALL reembolsar en caja los pagos completados del pedido hasta el total de la venta, descontando lo ya reembolsado por otras ventas del mismo pedido, con un pago REFUND de salida y su movimiento de caja, y SHALL dejar la venta en estado REFUNDED cuando haya reembolso.

#### Scenario: Pedido pagado en efectivo

- **WHEN** se anula la venta de un pedido pagado completo en efectivo
- **THEN** el sistema SHALL crear un REFUND por el total en el turno abierto, marcar REFUNDED el pago del pedido y dejar la venta Devuelta.

#### Scenario: Factura parcial del pedido

- **WHEN** se anula una venta que factura solo parte de un pedido pagado
- **THEN** el reembolso SHALL limitarse al total de esa venta y el pago del pedido SHALL seguir COMPLETED.

### Requirement: Anulacion de ventas del POS sin cambios

Las ventas con salidas propias SHALL seguir el flujo de anulacion existente sin consultar el pedido.

#### Scenario: Venta del POS

- **WHEN** se anula una venta del POS
- **THEN** el sistema SHALL revertir sus salidas propias como antes.
