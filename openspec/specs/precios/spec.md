# Spec: precios

## Proposito

Definir comportamiento esperado para precio actual, historial de precios, motivo obligatorio, auditoria de usuario, vigencia y compatibilidad con ventas historicas.

SUPUESTO: `products.price` seguira representando el precio actual mientras se agrega historial.

## Requirements

### Requirement: Precio actual

El sistema SHALL mantener un precio actual por producto para ventas nuevas.

#### Scenario: Venta nueva usa precio actual

- GIVEN un producto con precio actual
- WHEN el usuario agrega el producto al POS
- THEN el sistema SHALL usar el precio actual disponible para ese producto.

#### Scenario: Producto sin precio valido

- GIVEN un producto sin precio valido
- WHEN se intenta vender
- THEN el sistema SHALL rechazar la venta o bloquear el producto segun regla aprobada.

### Requirement: Historial de precios

El sistema SHALL registrar historial de cambios de precio.

#### Scenario: Cambio de precio

- GIVEN un usuario autorizado cambia el precio de un producto
- WHEN guarda el cambio
- THEN el sistema SHALL registrar precio anterior, precio nuevo, fecha, usuario y motivo.

#### Scenario: Consultar historial

- GIVEN un producto con varios cambios de precio
- WHEN se consulta historial
- THEN el sistema SHALL listar cambios ordenados por fecha descendente.

### Requirement: Cambio de precio con motivo obligatorio

El sistema SHALL exigir motivo para todo cambio de precio.

#### Scenario: Motivo faltante

- GIVEN un usuario cambia precio
- WHEN no informa motivo
- THEN el sistema SHALL rechazar el cambio.

#### Scenario: Motivo informado

- GIVEN un usuario cambia precio con motivo valido
- WHEN guarda
- THEN el sistema SHALL aceptar el cambio y registrar el motivo.

### Requirement: Auditoria de usuario

El sistema SHALL asociar cada cambio de precio a usuario, tenant y fecha.

#### Scenario: Usuario autenticado

- GIVEN un usuario autenticado
- WHEN cambia precio
- THEN el sistema SHALL guardar el identificador del usuario y tenant.

#### Scenario: Usuario no autenticado

- GIVEN una solicitud sin contexto de usuario valido
- WHEN intenta cambiar precio
- THEN el sistema SHALL rechazar la operacion.

### Requirement: Vigencia desde/hasta

El sistema SHALL soportar vigencia de precios.

#### Scenario: Precio vigente

- GIVEN un producto con historial de precios
- WHEN se consulta el precio actual
- THEN el sistema SHALL seleccionar el precio vigente para la fecha operativa.

#### Scenario: Vigencias solapadas

- GIVEN un producto con una vigencia activa
- WHEN se intenta crear otra vigencia solapada
- THEN el sistema SHALL rechazar o cerrar la vigencia anterior de forma controlada.

PREGUNTA ABIERTA: Se permitiran precios futuros programados?

### Requirement: Compatibilidad con ventas historicas

El sistema SHALL preservar el precio usado en ventas historicas.

#### Scenario: Precio cambia despues de una venta

- GIVEN una venta ya confirmada con `sale_items.price`
- WHEN cambia el precio actual del producto
- THEN la venta historica SHALL mantener el precio vendido originalmente.

#### Scenario: Reporte historico

- GIVEN un reporte de ventas pasado
- WHEN se genera despues de cambios de precio
- THEN el reporte SHALL usar precios guardados en la venta, no el precio actual.

## Riesgos

RIESGO: Recalcular ventas historicas con precio actual romperia contabilidad y tickets.

RIESGO: Cambios de precio sin motivo impiden auditoria operativa.

