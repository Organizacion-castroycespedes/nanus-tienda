## MODIFIED Requirements

### Requirement: Producto enriquecido

El sistema SHALL permitir que un producto tenga informacion operativa adicional sin romper los campos actuales (`name`, `sku`, `price`, `cost`, `unitId`, `taxId`, `isActive`) y SHALL incluir la politica ratificada `is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE`.

#### Scenario: Producto existente sin campos nuevos

- **WHEN** se consulta desde `api` o `web` un producto creado antes del cambio
- **THEN** el producto SHALL seguir siendo valido, SHALL comportarse como inventariable y `is_inventoryable` SHALL resolve to `TRUE`.

#### Scenario: Producto nuevo con configuracion operativa

- **WHEN** un usuario autorizado crea o edita un producto con atributos operativos
- **THEN** el sistema SHALL guardar si el producto es inventariable, perecedero, si requiere lote, si requiere vencimiento, su clasificacion operativa y su estado.

### Requirement: Producto perecedero/no perecedero

El sistema SHALL distinguir productos perecederos de no perecederos y SHALL aplicar esa distincion fisica solo cuando `is_inventoryable=true`.

#### Scenario: Producto perecedero inventariable

- **WHEN** se recibe inventario de un producto inventariable marcado como perecedero que tambien requiere vencimiento
- **THEN** el sistema SHALL exigir vencimiento y evaluar alertas de vencimiento para ese producto.

#### Scenario: Producto no inventariable con campos fisicos heredados

- **WHEN** se vende un producto no inventariable que conserva valores historicos en campos fisicos
- **THEN** esos campos SHALL quedar inactivos para stock, lotes, FEFO, reservas y alertas.

### Requirement: Producto con lote obligatorio

El sistema SHALL permitir configurar que un producto inventariable requiera lote para entradas y salidas de inventario, pero SHALL ignorar la regla para venta de productos no inventariables.

#### Scenario: Entrada sin lote para producto que requiere lote

- **WHEN** un usuario intenta recibir compra o ajustar inventario sin lote para un producto inventariable configurado con lote obligatorio
- **THEN** el sistema SHALL rechazar la operacion.

#### Scenario: Producto no inventariable

- **WHEN** se vende un producto no inventariable con `requires_lot=true` heredado
- **THEN** el sistema SHALL permitir la venta sin lote y SHALL NOT consumir lotes.

### Requirement: Producto con vencimiento obligatorio

El sistema SHALL permitir configurar vencimiento para productos inventariables y SHALL NOT exigirlo para productos no inventariables.

#### Scenario: Lote sin vencimiento

- **WHEN** se registra un lote sin fecha de vencimiento para un producto inventariable con vencimiento obligatorio
- **THEN** el sistema SHALL rechazar la operacion.

#### Scenario: No inventariable sin vencimiento

- **WHEN** se vende o factura un producto no inventariable sin vencimiento
- **THEN** el sistema SHALL permitir la operacion y SHALL NOT crear lote ni alerta fisica.

## ADDED Requirements

### Requirement: Configuracion individual de inventariabilidad

El sistema SHALL exponer `is_inventoryable` en contratos de producto e importacion sin permitir que categoria o subcategoria lo determine.

#### Scenario: Cambio autorizado

- **WHEN** un usuario autorizado solicita cambiar inventariabilidad
- **THEN** el backend SHALL aplicar la politica transaccional de transicion y auditoria.

#### Scenario: Cambio incompatible

- **WHEN** la transicion viola stock, reservas, lotes o tenant scope
- **THEN** el backend SHALL rechazarla sin modificar el producto.
