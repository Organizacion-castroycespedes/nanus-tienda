# Delta spec: precios

## ADDED Requirements

### Requirement: Precio actual compatible

El sistema SHALL mantener un precio actual compatible con `products.price`.

#### Scenario: Producto existente

- GIVEN un producto actual con `price`
- WHEN se consulta para POS
- THEN el sistema SHALL seguir entregando precio actual para venta.

### Requirement: Historial de precios

El sistema SHALL registrar todo cambio de precio.

#### Scenario: Cambio exitoso

- GIVEN un usuario autorizado
- WHEN cambia el precio de un producto
- THEN el sistema SHALL registrar precio anterior, precio nuevo, usuario, tenant, fecha y motivo.

#### Scenario: Cambio aplicado sin aprobacion inicial

- GIVEN un usuario autorizado informa motivo valido
- WHEN cambia el precio de un producto
- THEN el sistema SHALL registrar el historial con `status = APPLIED`.
- AND `approved_by` y `approved_at` SHALL permanecer nulos en la primera fase.

### Requirement: Motivo obligatorio

El sistema SHALL exigir motivo en cambios de precio.

#### Scenario: Cambio sin motivo

- GIVEN un cambio de precio
- WHEN el motivo esta vacio
- THEN el sistema SHALL rechazar el cambio.

### Requirement: Auditoria de usuario

El sistema SHALL asociar cambios de precio a usuario autenticado.

#### Scenario: Usuario invalido

- GIVEN una solicitud sin usuario valido
- WHEN intenta cambiar precio
- THEN el sistema SHALL rechazar la operacion.

### Requirement: Vigencia

El sistema SHALL soportar vigencia desde/hasta para precios.

#### Scenario: Precio vigente

- GIVEN varios registros historicos
- WHEN se calcula precio actual
- THEN el sistema SHALL usar el registro vigente para la fecha operativa.

PREGUNTA ABIERTA: Se permitiran precios futuros programados?

### Requirement: Preparacion para aprobacion futura

El modelo SHALL quedar preparado para aprobacion futura aunque no sea obligatoria inicialmente.

#### Scenario: Campos de aprobacion disponibles

- GIVEN una futura regla de aprobacion
- WHEN un cambio de precio requiera aprobacion
- THEN el historial SHALL poder registrar `status`, `approved_by` y `approved_at` sin cambiar ventas historicas.

#### Scenario: Motivo siempre obligatorio

- GIVEN un cambio de precio en cualquier estado
- WHEN se guarda el historial
- THEN `reason` SHALL ser obligatorio y no vacio.

### Requirement: Ventas historicas estables

El sistema SHALL conservar precio historico de ventas confirmadas.

#### Scenario: Cambio posterior a venta

- GIVEN una venta confirmada
- WHEN cambia el precio del producto
- THEN el `sale_items.price` historico SHALL permanecer sin cambios.

RIESGO: Recalcular ventas pasadas con precio actual romperia reportes y tickets.
