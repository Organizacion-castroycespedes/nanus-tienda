# precios Specification

## Purpose

Definir comportamiento esperado para precio actual, historial de precios, motivo obligatorio, auditoria de usuario, vigencia y compatibilidad con ventas historicas.

Supuesto heredado: `products.price` seguira representando el precio actual mientras se agrega historial.

Pregunta abierta heredada:

- Se debe definir si se permitiran precios futuros programados.

Riesgos heredados:

- Recalcular ventas historicas con precio actual romperia contabilidad y tickets.
- Cambios de precio sin motivo impiden auditoria operativa.
## Requirements
### Requirement: Precio actual

El sistema SHALL mantener un precio actual por producto para ventas nuevas.

#### Scenario: Venta nueva usa precio actual

- **WHEN** el usuario agrega al POS un producto con precio actual
- **THEN** el sistema SHALL usar el precio actual disponible para ese producto.

#### Scenario: Producto sin precio valido

- **WHEN** se intenta vender un producto sin precio valido
- **THEN** el sistema SHALL rechazar la venta o bloquear el producto segun regla aprobada.

### Requirement: Historial de precios

El sistema SHALL registrar historial de cambios de precio.

#### Scenario: Cambio de precio

- **WHEN** un usuario autorizado guarda un cambio de precio de producto
- **THEN** el sistema SHALL registrar precio anterior, precio nuevo, fecha, usuario y motivo.

#### Scenario: Consultar historial

- **WHEN** se consulta historial de un producto con varios cambios de precio
- **THEN** el sistema SHALL listar cambios ordenados por fecha descendente.

### Requirement: Cambio de precio con motivo obligatorio

El sistema SHALL exigir motivo para todo cambio de precio.

#### Scenario: Motivo faltante

- **WHEN** un usuario intenta cambiar precio sin informar motivo
- **THEN** el sistema SHALL rechazar el cambio.

#### Scenario: Motivo informado

- **WHEN** un usuario guarda un cambio de precio con motivo valido
- **THEN** el sistema SHALL aceptar el cambio y registrar el motivo.

### Requirement: Auditoria de usuario

El sistema SHALL asociar cada cambio de precio a usuario, tenant y fecha.

#### Scenario: Usuario autenticado

- **WHEN** un usuario autenticado cambia precio
- **THEN** el sistema SHALL guardar el identificador del usuario y tenant.

#### Scenario: Usuario no autenticado

- **WHEN** una solicitud sin contexto de usuario valido intenta cambiar precio
- **THEN** el sistema SHALL rechazar la operacion.

### Requirement: Vigencia desde/hasta

El sistema SHALL soportar vigencia de precios.

#### Scenario: Precio vigente

- **WHEN** se consulta el precio actual de un producto con historial de precios
- **THEN** el sistema SHALL seleccionar el precio vigente para la fecha operativa.

#### Scenario: Vigencias solapadas

- **WHEN** se intenta crear una vigencia de precio solapada con una vigencia activa
- **THEN** el sistema SHALL rechazar la nueva vigencia o cerrar la vigencia anterior de forma controlada.

### Requirement: Compatibilidad con ventas historicas

El sistema SHALL preservar el precio usado en ventas historicas.

#### Scenario: Precio cambia despues de una venta

- **WHEN** cambia el precio actual de un producto despues de una venta confirmada con `sale_items.price`
- **THEN** la venta historica SHALL mantener el precio vendido originalmente.

#### Scenario: Reporte historico

- **WHEN** se genera un reporte de ventas pasado despues de cambios de precio
- **THEN** el reporte SHALL usar precios guardados en la venta, no el precio actual.

