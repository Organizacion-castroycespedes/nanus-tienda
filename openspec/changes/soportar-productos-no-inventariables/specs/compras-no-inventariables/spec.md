## ADDED Requirements

### Requirement: Compra comercial de servicios

El sistema SHALL permitir crear y editar una compra con lineas de productos `is_inventoryable=false`, derivando la politica desde `products` dentro del tenant y conservando los contratos existentes de proveedor, costo, subtotal, documento, estado, pago y auditoria.

#### Scenario: Compra solo de servicios

- **WHEN** un usuario autorizado crea una compra con una o mas lineas no inventariables
- **THEN** el sistema SHALL registrar la compra comercial sin exigir stock, `IN`, lote, FEFO, reserva o valoracion fisica.

#### Scenario: Producto de otro tenant

- **WHEN** una linea referencia un producto de otro tenant o fuera del alcance autorizado
- **THEN** el sistema SHALL rechazar la compra sin revelar datos ni crear encabezado, linea, pago o movimiento.

### Requirement: Compra mixta por linea

El sistema SHALL permitir una compra que mezcle lineas inventariables y no inventariables. La politica efectiva SHALL ser server-side por producto y no SHALL depender de categoria, subcategoria o un flag del cliente.

#### Scenario: Compra mixta valida

- **WHEN** todas las lineas pertenecen al tenant y tienen cantidades, costos y subtotales validos
- **THEN** el sistema SHALL conservar todas las lineas en una sola compra y SHALL clasificar por linea los efectos comerciales y fisicos.

#### Scenario: Servicio comprado para reventa

- **WHEN** una linea de servicio se adquiere para venderla posteriormente
- **THEN** el sistema SHALL conservar costo y trazabilidad comercial sin crear stock ni valoracion fisica.

#### Scenario: Servicio para consumo interno o gasto operativo

- **WHEN** una linea de servicio se adquiere para consumo interno o gasto operativo
- **THEN** el sistema SHALL conservar proveedor, costo, documento y pago, pero SHALL no inferir una cuenta, asiento o naturaleza contable que no este soportada por un contrato aprobado.

#### Scenario: Transporte

- **WHEN** una compra contiene transporte u otro servicio logistico
- **THEN** el sistema SHALL conservarlo como linea de servicio y SHALL no clasificarlo automaticamente como costo de inventario.

### Requirement: Cantidades comerciales y efectos fisicos

El sistema SHALL mantener `purchase_items.ordered_quantity` y `purchase_items.received_quantity` como cantidades comerciales. Para lineas inventariables, el efecto fisico SHALL derivarse de `stock_movements` y enlaces de lotes existentes; no se SHALL agregar una cantidad fisica nueva sin necesidad demostrada.

#### Scenario: Recepcion comercial de servicio

- **WHEN** el usuario confirma que una linea de servicio fue prestada o aceptada
- **THEN** el sistema SHALL avanzar su estado o cantidad comercial y SHALL no crear `stock_movements` `IN`, lotes, FEFO, reservas ni valoracion fisica.

#### Scenario: Recepcion de servicio no automatica

- **WHEN** solo se crea la compra, se registra un pago o se adjunta un documento de proveedor sin una accion explicita de recepcion del usuario
- **THEN** el sistema SHALL no incrementar `received_quantity`, no cerrar comercialmente la linea y no generar efectos fisicos.

#### Scenario: Recepcion comercial no prueba stock

- **WHEN** una linea no inventariable incrementa `received_quantity`
- **THEN** ese valor SHALL representar solo recepcion comercial y SHALL no autorizar stock, lote, FEFO o valoracion fisica.

#### Scenario: Recepcion fisica de inventariable

- **WHEN** el usuario recibe una linea `is_inventoryable=true`
- **THEN** el sistema SHALL conservar las validaciones actuales de cantidad pendiente, sucursal, lotes, vencimientos, costo, `IN`, snapshots y valoracion.

#### Scenario: Varias lineas del mismo producto

- **WHEN** una compra contiene mas de una linea con el mismo `product_id`
- **THEN** la recepcion SHALL exigir `purchaseItemId` o aplicar una asignacion determinista y auditable, sin depender del orden accidental del payload.

#### Scenario: Recepcion parcial

- **WHEN** solo se recibe una parte de una compra o de sus lineas
- **THEN** el sistema SHALL conservar estado parcial y cantidades comerciales/fisicas separadas por linea, sin cerrar lineas pendientes ni crear saldo fisico para `FALSE`.

#### Scenario: Recepcion mixta atomica

- **WHEN** una solicitud contiene lineas de servicio y fisicas y una validacion obligatoria falla
- **THEN** el sistema SHALL hacer rollback de todos los efectos de la solicitud, incluyendo estados comerciales, `IN`, lotes, snapshots, auditoria de exito y pagos generados por esa misma solicitud.

### Requirement: Pagos y documentos de compra

El sistema SHALL preservar las referencias de pago `PURCHASE` y `PURCHASE_ORDER`, la direccion `OUT`, las asignaciones por tenant y la sincronizacion de `payment_status`, `total_paid`, `balance_due` y `balance`.

#### Scenario: Pago de compra de servicios

- **WHEN** se paga una compra solo de servicios
- **THEN** el sistema SHALL actualizar el estado financiero existente sin crear movimiento de inventario ni asumir asiento contable no definido.

#### Scenario: Pago de compra mixta

- **WHEN** se paga una compra mixta
- **THEN** el pago SHALL cubrir el documento comercial conforme a sus reglas existentes y SHALL no convertir lineas `FALSE` en inventario.

#### Scenario: Impuestos de compra

- **WHEN** el contrato de compra no expone campos o reglas de impuestos
- **THEN** la implementacion SHALL preservar costos y subtotales existentes y SHALL registrar la decision de impuestos pendiente, sin inventar tablas, tasas o asientos.

### Requirement: Limite contable de HU-PRODUCT

HU-PRODUCT SHALL conservar informacion comercial auditable para una integracion futura y SHALL NOT crear ni modificar plan de cuentas, cuentas, asientos automaticos, libros, balances, estados financieros o clasificacion contable automatica.

#### Scenario: Servicio con destino comercial

- **WHEN** una linea de servicio se marca para reventa, consumo interno, gasto operativo o transporte
- **THEN** el sistema SHALL conservar proveedor, costo, documento, estado y pago conforme a contratos existentes y SHALL no inferir naturaleza contable ni valoracion fisica.

### Requirement: Estados, cancelacion y devolucion

El sistema SHALL conservar `PENDING`, `PARTIAL`, `RECEIVED`, `CERRADA_PARCIAL` y `CANCELLED`. Estos estados SHALL representar el avance comercial de `received_quantity`; los efectos fisicos de lineas `TRUE` SHALL verificarse en movimientos y lotes. La cancelacion o devolucion SHALL revertir efectos fisicos solo para lineas `TRUE` y SHALL rechazar cualquier cancelacion que deje pagos, documentos o efectos no revertidos.

#### Scenario: Cancelacion antes de recepcion

- **WHEN** una compra de servicios o mixta esta en estado cancelable y no tiene recepcion ni pago incompatible
- **THEN** el sistema SHALL cancelarla con auditoria sin crear ni revertir stock inexistente.

#### Scenario: Cancelacion despues de efectos

- **WHEN** una compra tiene recepcion, pago o liquidacion parcial
- **THEN** el sistema SHALL usar el flujo autorizado de reverso, devolucion, nota o reembolso y SHALL no borrar historial.

#### Scenario: Cancelacion de servicio recibido

- **WHEN** una compra de servicios tiene `received_quantity` comercial positivo pero no tiene movimientos fisicos
- **THEN** el sistema SHALL aplicar un reverso comercial autorizado con actor, motivo, fecha y referencia recuperable usando el permiso existente `INVENTORY_PURCHASES`/`WRITE`/`cancel`, o rechazar con razon explicita si ese contrato no existe, y SHALL no exigir ni crear un movimiento fisico ficticio.

#### Scenario: Liquidacion parcial existente

- **WHEN** una compra parcial se liquida con lineas de servicio y fisicas
- **THEN** el sistema SHALL conservar el calculo comercial existente basado en `received_quantity * cost`, pagos y estados, sin convertir servicios en valoracion fisica ni crear asientos nuevos.

#### Scenario: Devolucion mixta

- **WHEN** se devuelve una compra mixta
- **THEN** solo las lineas inventariables SHALL generar reverso fisico conforme al flujo vigente; las lineas de servicio SHALL tener reverso comercial o financiero sin `OUT` o lote ficticio.

### Requirement: Idempotencia de recepcion

El sistema SHALL impedir que un reintento de la misma recepcion duplique cantidad, pagos, movimientos, lotes o auditoria de exito. El contrato SHALL usar el header `Idempotency-Key`, scoped por `tenant_id`, `purchase_id` e idempotency key, `request_hash` de 64 caracteres hexadecimales, estado de operacion, resultado recuperable o referencia de operacion y timestamps. La implementacion actual reclama y completa `purchase_receipt_idempotency` dentro de la misma transaccion de recepcion; `sale_creation_idempotency` y `document_payment_operations` son patrones de referencia de otros dominios, no ledger reutilizable de compras.

#### Scenario: Reintento despues de timeout

- **WHEN** el cliente reenvia una recepcion cuyo resultado pudo confirmarse en la transaccion anterior
- **THEN** el sistema SHALL devolver el resultado idempotente o rechazar el duplicado sin nuevos efectos.

#### Scenario: Misma clave y payload distinto

- **WHEN** se reusa la misma clave con un hash de payload diferente
- **THEN** el sistema SHALL responder conflicto y SHALL no tocar cantidades, movimientos, lotes, pagos ni estado.

#### Scenario: Reintento concurrente

- **WHEN** dos solicitudes concurrentes usan la misma clave de recepcion
- **THEN** solo una SHALL aplicar efectos; la otra SHALL esperar o responder conflicto controlado y SHALL devolver el resultado confirmado sin duplicar.

#### Scenario: Payload igual con clave distinta

- **WHEN** se envia el mismo payload con una clave nueva
- **THEN** el sistema SHALL tratarlo como una operacion nueva y SHALL permitirlo solo si existe cantidad comercial pendiente y las validaciones actuales lo autorizan.

#### Scenario: Retencion sin purga automatica

- **WHEN** la operacion de recepcion termina y no existe una politica posterior aprobada de retencion
- **THEN** el ledger SHALL conservar el resultado recuperable y auditable, y esta HU SHALL no ejecutar purga automatica.

### Requirement: Concurrencia de compras y V108

El sistema SHALL conservar `inventory_lock_stock_scope`, el orden estable de productos, el trigger de snapshots y el rechazo de stock negativo de V108. La recepcion SHALL coordinar esos locks con la fila de compra y con las transiciones de `is_inventoryable`.

#### Scenario: Venta y recepcion concurrentes

- **WHEN** una venta y una recepcion afectan el mismo producto inventariable y sucursal
- **THEN** ambas operaciones SHALL serializar sus locks de forma compatible y SHALL conservar snapshots consistentes sin stock negativo.

#### Scenario: Transicion y recepcion concurrentes

- **WHEN** `TRUE -> FALSE` o `FALSE -> TRUE` concurre con una recepcion o compra
- **THEN** el resultado SHALL ser serializable, sin leer una politica intermedia, sin inventario ficticio y sin deadlock por orden de locks.

#### Scenario: `branch_id` nulo

- **WHEN** una recepcion fisica encuentra `branch_id IS NULL`
- **THEN** el sistema SHALL rechazar o regularizar con un branch autorizado antes del movimiento y SHALL no usar el retorno temprano del trigger como bypass. Las operaciones fisicas nuevas SHALL exigir branch valido; la restriccion global de datos queda sujeta a medicion del legado.

### Requirement: Fuente de reservas para transiciones

El sistema SHALL usar `inventory_lot_balances.quantity_reserved` como evidencia actual de reserva fisica mientras no exista una entidad de reservas independiente demostrada. La transicion `TRUE -> FALSE` SHALL evaluar todas las sucursales del tenant y SHALL rechazar cualquier reserva positiva, saldo fisico positivo o lote operativo no regularizado.

#### Scenario: Reserva activa en cualquier sucursal

- **WHEN** un producto tiene `quantity_reserved > 0` en cualquier `inventory_lot_balances` del tenant
- **THEN** el sistema SHALL rechazar `TRUE -> FALSE` sin cambiar la politica ni alterar movimientos.

### Requirement: Reportes de compras

Los reportes comerciales y de caja SHALL incluir compras de servicios y mixtas sin duplicar totales. Los reportes fisicos SHALL excluir lineas `FALSE` de stock, lotes, FEFO y valoracion.

#### Scenario: Reporte comercial de compra mixta

- **WHEN** se consulta una compra mixta
- **THEN** el reporte SHALL mostrar proveedor, costos, subtotales, pagos, estado comercial y clasificacion por linea cuando el contrato de reporte lo soporte.

#### Scenario: Reporte de valoracion

- **WHEN** se calcula inventario o valoracion fisica
- **THEN** solo lineas `TRUE` recibidas SHALL participar y servicios SHALL quedar fuera o con estado `NOT_APPLICABLE`.

### Requirement: Aislamiento y auditoria

Toda compra, linea, pago, recepcion, reporte y transicion SHALL filtrar por `tenant_id` y respetar el alcance de `branch_id`; los cambios de politica y recepcion SHALL conservar actor, fecha, motivo y trazabilidad disponible.

#### Scenario: Sucursal no autorizada

- **WHEN** una recepcion fisica solicita una sucursal fuera del alcance
- **THEN** el sistema SHALL rechazar toda la solicitud sin cambios comerciales ni fisicos.
