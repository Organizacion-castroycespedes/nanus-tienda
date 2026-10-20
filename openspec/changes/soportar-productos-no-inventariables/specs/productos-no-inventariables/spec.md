## ADDED Requirements

### Requirement: Politica de inventariabilidad por producto

El sistema SHALL persistir `products.is_inventoryable` como `BOOLEAN NOT NULL DEFAULT TRUE`, con nombre y default ratificados, y SHALL derivar la politica desde el producto perteneciente al tenant autenticado. Los productos existentes SHALL conservar `TRUE`.

#### Scenario: Producto historico

- **WHEN** se consulta un producto creado antes de esta capacidad
- **THEN** el producto SHALL comportarse como inventariable y SHALL conservar sus movimientos, lotes, precios y datos fiscales.

#### Scenario: Categoria no decide inventariabilidad

- **WHEN** se cambia categoria o subcategoria de un producto
- **THEN** el valor efectivo de `is_inventoryable` SHALL permanecer sin cambios.

### Requirement: Venta de producto no inventariable

El sistema SHALL permitir vender y facturar un producto con `is_inventoryable=false` sin exigir stock previo, sin consultar existencias para autorizar la venta, sin crear movimientos `IN`/`OUT`, sin consumir lotes y sin ejecutar FEFO.

#### Scenario: Servicio sin stock

- **WHEN** un usuario autorizado agrega un servicio activo al POS y confirma una venta
- **THEN** la venta SHALL continuar aunque el stock sea cero o no exista movimiento de inventario.

#### Scenario: Servicio sin movimiento fisico

- **WHEN** una venta contiene una linea no inventariable
- **THEN** el sistema SHALL guardar la linea comercial y SHALL NOT crear `stock_movements` para ella.

### Requirement: Preservacion comercial y fiscal

El sistema SHALL conservar para productos no inventariables los `sale_items`, precios, costos comerciales, descuentos, impuestos, pagos, `sale_type`, `measurement_unit`, categorias, subcategorias, identificaciones y datos requeridos por DIAN.

#### Scenario: Servicio con impuestos y descuento

- **WHEN** se vende un servicio con impuestos y descuento
- **THEN** `sale_items`, snapshots de impuestos, descuentos y total cobrado SHALL coincidir con el flujo comercial vigente.

#### Scenario: Facturacion electronica de servicio

- **WHEN** una venta de servicio genera el evento de facturacion electronica
- **THEN** el outbox y DIAN SHALL recibir los datos comerciales y fiscales sin exigir stock, lote o movimiento `OUT`.

### Requirement: Venta mixta atomica

El sistema SHALL procesar en una unica transaccion una venta que mezcle productos inventariables y no inventariables.

#### Scenario: Venta mixta valida

- **WHEN** las lineas inventariables tienen stock y las lineas no inventariables tienen datos comerciales validos
- **THEN** el sistema SHALL guardar toda la venta, crear movimientos solo para inventariables y conservar todas las lineas, impuestos y pagos.

#### Scenario: Venta mixta sin stock

- **WHEN** una linea inventariable no puede cumplir stock o FEFO
- **THEN** el sistema SHALL revertir la venta completa y SHALL NOT dejar lineas de servicio, pagos ni movimientos parciales.

### Requirement: Transicion auditada de inventariabilidad

El sistema SHALL permitir cambios controlados de `TRUE` a `FALSE` y de `FALSE` a `TRUE`, con auditoria y aislamiento por tenant. El backend SHALL exigir motivo para el cambio a `FALSE` y registrar actor, valores y motivo. Para `TRUE -> FALSE`, la reserva activa SHALL derivarse de `inventory_lot_balances.quantity_reserved`; no se SHALL asumir una tabla de reservas no demostrada.

#### Scenario: Desactivar con saldo fisico

- **WHEN** se solicita `TRUE -> FALSE` y existe saldo operativo en cualquier sucursal aplicable
- **THEN** el sistema SHALL rechazar el cambio sin modificar el producto.

#### Scenario: Desactivar con reservas o lotes no regularizados

- **WHEN** se solicita `TRUE -> FALSE` y existen reservas activas o saldos de lote no regularizados
- **THEN** el sistema SHALL rechazar el cambio sin modificar movimientos ni configuracion.

#### Scenario: Desactivar con reserva en otra sucursal

- **WHEN** se solicita `TRUE -> FALSE` y `quantity_reserved > 0` o existe saldo/lote operativo pendiente en cualquier sucursal del tenant
- **THEN** el sistema SHALL rechazar el cambio aunque la sucursal de la solicitud no tenga saldo, y SHALL conservar la trazabilidad existente.

#### Scenario: Desactivar producto regularizado

- **WHEN** en todas las sucursales del tenant cada saldo muestra `quantity_on_hand = 0`, `quantity_reserved = 0` y `quantity_available = 0`, y no existe lote `ACTIVE` con saldo o reserva positiva
- **THEN** el sistema SHALL cambiar a `FALSE` y SHALL registrar actor, tenant, producto, valores anterior/nuevo, fecha y motivo.

#### Scenario: Reactivar sin inventario ficticio

- **WHEN** se solicita `FALSE -> TRUE`
- **THEN** el sistema SHALL activar el control fisico sin crear stock, lotes ni movimientos sinteticos.

### Requirement: Compras y operaciones fisicas de no inventariables

El sistema SHALL permitir el registro comercial de compras de servicios y compras mixtas, pero SHALL impedir que una linea no inventariable cree existencias o efectos fisicos. La recepcion comercial de una linea `FALSE` no equivale a recepcion fisica.

#### Scenario: Compra solo de servicios

- **WHEN** se crea o edita una compra con solo lineas `is_inventoryable=false`
- **THEN** el sistema SHALL conservar proveedor, costos, subtotales, documento, estado comercial y pagos segun los contratos existentes, y SHALL no crear `stock_movements` `IN`, lotes, FEFO, reservas ni valoracion fisica.

#### Scenario: Compra mixta

- **WHEN** una compra contiene lineas inventariables y no inventariables
- **THEN** la compra SHALL conservar todas las lineas; la recepcion comercial de `FALSE` SHALL avanzar sin inventario y la recepcion fisica de `TRUE` SHALL conservar `IN`, lotes, FEFO y valoracion existentes.

#### Scenario: Servicio para reventa o consumo interno

- **WHEN** una compra de servicio se marca para reventa, consumo interno o gasto operativo
- **THEN** el sistema SHALL conservar el destino comercial declarado sin inferir automaticamente una cuenta contable ni convertirlo en inventario.

#### Scenario: Recepcion fisica de servicio

- **WHEN** se intenta recibir inventario o crear un movimiento `IN` para un producto no inventariable
- **THEN** el sistema SHALL rechazar la operacion con un error de dominio y SHALL conservar el ledger sin cambios.

#### Scenario: Ajuste fisico de servicio

- **WHEN** se intenta ajustar stock, lote o reserva de un producto no inventariable
- **THEN** el sistema SHALL rechazar la operacion y SHALL NOT crear registros fisicos.

#### Scenario: Recepcion mixta atomica

- **WHEN** una solicitud de recepcion incluye lineas fisicas validas y una linea de servicio con datos invalidos, o falla una validacion obligatoria
- **THEN** el sistema SHALL revertir los efectos de toda la solicitud y SHALL NOT dejar `IN`, lotes, estados comerciales o pagos parciales.

#### Scenario: Reintento de recepcion

- **WHEN** se reintenta la misma recepcion por timeout o reenvio del cliente
- **THEN** el sistema SHALL aplicar idempotencia o deduplicacion equivalente y SHALL NOT duplicar cantidades, movimientos, lotes o pagos.

#### Scenario: Timeout despues de commit

- **WHEN** el cliente pierde la respuesta despues de que la transaccion de recepcion confirma
- **THEN** una consulta con la misma clave SHALL recuperar el resultado confirmado y SHALL NOT crear una segunda recepcion.

#### Scenario: Mismo producto en varias lineas

- **WHEN** una compra tiene varias lineas para el mismo producto
- **THEN** la recepcion SHALL identificar la linea por `purchaseItemId` o una asignacion determinista y auditable.

### Requirement: Pedidos y entregas de servicios

El sistema SHALL permitir completar o facturar lineas de servicio en pedidos sin validacion de stock, salida `OUT`, lote o FEFO, manteniendo cantidades, estados y totales comerciales.

#### Scenario: Entrega de servicio

- **WHEN** se entrega un pedido que contiene un servicio no inventariable
- **THEN** el sistema SHALL avanzar la cantidad comercial de la linea sin crear movimiento de inventario.

#### Scenario: Pedido mixto

- **WHEN** un pedido contiene productos fisicos y servicios
- **THEN** la entrega SHALL aplicar stock y lotes solo a fisicos y SHALL conservar atomicidad de la operacion aprobada.

### Requirement: Cancelaciones y devoluciones

El sistema SHALL revertir movimientos solo para lineas inventariables y SHALL conservar trazabilidad comercial y fiscal para servicios.

#### Scenario: Cancelar servicio

- **WHEN** se cancela o devuelve una linea no inventariable
- **THEN** el sistema SHALL revertir la venta segun el flujo comercial y SHALL NOT crear movimiento fisico reverso.

#### Scenario: Cancelar producto fisico

- **WHEN** se cancela o devuelve una linea inventariable con salida previa
- **THEN** el sistema SHALL conservar el flujo actual de reverso, lotes, snapshots y locks.

### Requirement: Importacion compatible

La importacion SHALL aceptar y actualizar `is_inventoryable` mediante el mismo servicio de producto, aplicando las transiciones y validaciones tenant-safe.

#### Scenario: Importar producto existente

- **WHEN** una fila de importacion cambia inventariabilidad
- **THEN** el sistema SHALL aplicar las mismas reglas de transicion de la API y SHALL registrar auditoria si el cambio es permitido.

#### Scenario: Importar producto fisico historico

- **WHEN** una fila no informa `is_inventoryable` para un producto existente
- **THEN** el sistema SHALL conservar el comportamiento inventariable compatible.

### Requirement: Concurrencia con V108

La capacidad SHALL conservar `inventory_lock_stock_scope`, el bloqueo ordenado de productos, el trigger de snapshots y el rechazo de salidas con stock negativo definidos por V108.

#### Scenario: Venta concurrente

- **WHEN** dos ventas concurrentes afectan el mismo producto inventariable y sucursal
- **THEN** los locks transaccionales SHALL serializar la lectura y escritura sin stock negativo ni snapshots inconsistentes.

#### Scenario: Transicion concurrente

- **WHEN** una transicion de inventariabilidad concurre con una venta o recepcion del mismo producto
- **THEN** ambas operaciones SHALL usar un orden de locks compatible y SHALL producir un resultado serializable sin deadlock ni bypass de la politica.

#### Scenario: Sucursal nula

- **WHEN** una operacion encuentra `branch_id IS NULL`
- **THEN** el flujo SHALL aplicar una regla explicita de rechazo o regularizacion y SHALL NOT depender del retorno temprano del trigger como autorizacion.

### Requirement: Aislamiento tenant y sucursal

Toda lectura de producto, stock, reservas, lotes, ventas, transiciones y reportes SHALL filtrar por `tenant_id`; toda existencia fisica SHALL filtrar tambien por `branch_id` autorizado.

#### Scenario: Producto de otro tenant

- **WHEN** un cliente intenta vender, editar o cambiar la politica de un producto de otro tenant
- **THEN** el sistema SHALL rechazar la operacion sin revelar datos ni crear efectos.

#### Scenario: Sucursal no autorizada

- **WHEN** una operacion fisica solicita una sucursal fuera del alcance del usuario
- **THEN** el sistema SHALL rechazarla sin leer ni modificar stock de otra sucursal.

### Requirement: Reportes de servicios

Los reportes comerciales SHALL incluir servicios y los reportes fisicos SHALL distinguir `NOT_APPLICABLE` de `OUT_OF_STOCK`.

#### Scenario: Reporte comercial

- **WHEN** se consulta ventas por periodo
- **THEN** las ventas de servicios SHALL aparecer con sus importes, impuestos, descuentos y pagos.

#### Scenario: Reporte fisico

- **WHEN** se consulta inventario, lotes, FEFO, minimos o valorizacion
- **THEN** los servicios SHALL quedar fuera de metricas fisicas o aparecer con estado `NOT_APPLICABLE`, nunca como agotados.
