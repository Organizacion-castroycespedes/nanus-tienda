## MODIFIED Requirements

### Requirement: Existencias por sucursal

El sistema SHALL calcular y consultar existencias por tenant, sucursal y producto solo cuando el producto sea inventariable.

#### Scenario: Consultar stock por sucursal

- **WHEN** se consulta inventario por sucursal para un producto inventariable con movimientos en varias sucursales
- **THEN** el sistema SHALL mostrar solo el stock de la sucursal autorizada.

#### Scenario: Producto no inventariable

- **WHEN** se consulta inventario por sucursal para un producto no inventariable
- **THEN** el sistema SHALL devolver estado `NOT_APPLICABLE` o excluirlo segun el contrato del reporte, sin clasificarlo como agotado.

### Requirement: Existencias por lote

El sistema SHALL soportar existencias por lote para productos inventariables que lo requieran y SHALL omitir lotes para productos no inventariables.

#### Scenario: Stock por lote

- **WHEN** se consulta detalle de inventario para un producto inventariable con dos lotes en la misma sucursal
- **THEN** el sistema SHALL mostrar cantidad disponible por lote.

#### Scenario: Producto no inventariable

- **WHEN** se consulta inventario de un producto no inventariable
- **THEN** el sistema SHALL no crear, consumir ni calcular saldo operativo de lotes para autorizar la venta.

### Requirement: Vencimientos

El sistema SHALL asociar vencimiento a lotes de productos inventariables cuando aplique y SHALL desactivar la regla para productos no inventariables.

#### Scenario: Producto proximo a vencer

- **WHEN** se consulta inventario o alertas para un lote de producto inventariable con vencimiento dentro de la ventana configurada
- **THEN** el sistema SHALL marcarlo como proximo a vencer.

#### Scenario: Servicio sin vencimiento

- **WHEN** se consulta o vende un producto no inventariable con campos de vencimiento heredados
- **THEN** el sistema SHALL no exigir vencimiento ni generar alerta fisica.

### Requirement: Reglas FEFO

El sistema SHALL usar FEFO para productos inventariables perecederos o loteados cuando descuente inventario y SHALL omitir FEFO para productos no inventariables.

#### Scenario: Venta con multiples lotes

- **WHEN** se vende un producto inventariable con varios lotes disponibles
- **THEN** el sistema SHALL descontar primero el lote con vencimiento mas cercano no vencido.

#### Scenario: Servicio sin lote

- **WHEN** se vende un producto no inventariable
- **THEN** el sistema SHALL no consultar ni consumir lotes FEFO.

### Requirement: Ajustes de inventario

El sistema SHALL permitir ajustes `IN` y `OUT` con trazabilidad para productos inventariables y SHALL rechazar ajustes fisicos de productos no inventariables.

#### Scenario: Ajuste con motivo

- **WHEN** un usuario autorizado confirma un ajuste de stock de un producto inventariable
- **THEN** el sistema SHALL exigir motivo y persistirlo junto con la trazabilidad.

#### Scenario: Ajuste de servicio

- **WHEN** un usuario intenta ajustar stock de un producto no inventariable
- **THEN** el sistema SHALL rechazar la operacion y SHALL no crear movimiento.

### Requirement: Entradas desde compras

El sistema SHALL crear inventario desde recepcion de compras solo para lineas inventariables. `ordered_quantity` y `received_quantity` SHALL conservar su significado comercial; el efecto fisico SHALL derivarse de movimientos y lotes existentes. Las compras de servicios pueden tener recepcion comercial, pero no crean inventario fisico.

#### Scenario: Compra recibida parcialmente

- **WHEN** se recibe una parte de una compra con cantidades pedidas de productos inventariables
- **THEN** el sistema SHALL crear stock solo por cantidad recibida.

#### Scenario: Recepcion comercial de servicio

- **WHEN** se confirma la prestacion o aceptacion comercial de una linea no inventariable
- **THEN** el sistema SHALL actualizar solo el estado o cantidad comercial segun el contrato de compras y SHALL no crear `IN`, lote, reserva ni valoracion fisica.

#### Scenario: Cantidad comercial de inventariable

- **WHEN** `received_quantity` aumenta para una linea inventariable
- **THEN** el sistema SHALL exigir el movimiento `IN` transaccional correspondiente y SHALL no depender de una futura columna de cantidad fisica.

#### Scenario: Recepcion mixta de compra

- **WHEN** una compra contiene lineas inventariables y no inventariables
- **THEN** la misma transaccion SHALL aplicar `IN`, lotes, FEFO y valoracion solo a `TRUE`, y SHALL confirmar comercialmente `FALSE` sin movimiento fisico.

#### Scenario: Error en una linea mixta

- **WHEN** una linea de la recepcion mixta falla validacion de cantidad, lote, sucursal, producto o politica
- **THEN** el sistema SHALL revertir toda la solicitud y SHALL no dejar movimientos ni estados parciales.

### Requirement: Salidas desde ventas

El sistema SHALL descontar inventario desde ventas POS y pedidos para productos inventariables y SHALL conservar la venta comercial sin salida fisica para productos no inventariables.

#### Scenario: Venta POS inventariable

- **WHEN** se confirma una venta POS de un producto inventariable con stock disponible
- **THEN** el sistema SHALL crear salida de inventario y guardar trazabilidad de venta.

#### Scenario: Venta POS no inventariable

- **WHEN** se confirma una venta POS de un producto no inventariable
- **THEN** el sistema SHALL guardar la venta y SHALL no crear salida de inventario.

#### Scenario: Cancelacion de venta

- **WHEN** se cancela o reembolsa una venta con lineas inventariables y no inventariables
- **THEN** el sistema SHALL revertir solo las salidas de las lineas inventariables.

## ADDED Requirements

### Requirement: Protocolo V108 para escritores fisicos

Todos los escritores de stock SHALL conservar `inventory_lock_stock_scope`, el orden determinista de productos, el trigger de snapshots y el rechazo de stock negativo definido por V108.

#### Scenario: Operacion multi-producto

- **WHEN** una venta, recepcion, entrega o ajuste afecta varios productos inventariables
- **THEN** la operacion SHALL adquirir los locks por producto en orden estable antes de leer o escribir saldos.

#### Scenario: Sucursal nula

- **WHEN** un escritor recibe `branch_id IS NULL`
- **THEN** SHALL aplicar una regla explicita de rechazo o regularizacion y SHALL no tratar el retorno temprano del trigger como validacion suficiente.

### Requirement: Reservas y transiciones

El sistema SHALL impedir `TRUE -> FALSE` mientras existan reservas activas, stock operativo o saldos de lote pendientes en el alcance aprobado. La fuente actual de reserva SHALL ser `inventory_lot_balances.quantity_reserved`, con sus invariantes existentes; no se SHALL inventar una entidad de reservas.

#### Scenario: Transicion bloqueada

- **WHEN** una transicion encuentra stock, reserva activa o lote no regularizado
- **THEN** SHALL rechazarla atomica y auditadamente sin cambiar el producto.

#### Scenario: Reserva en cualquier sucursal

- **WHEN** `quantity_reserved > 0` o existe saldo de lote operativo pendiente en cualquier sucursal del tenant
- **THEN** SHALL rechazar `TRUE -> FALSE` aunque la sucursal de la solicitud no tenga saldo local.

#### Scenario: Transicion concurrente

- **WHEN** una recepcion o venta concurre con una transicion de inventariabilidad
- **THEN** ambas operaciones SHALL coordinarse con el protocolo advisory y SHALL evitar deadlocks y estados intermedios.
