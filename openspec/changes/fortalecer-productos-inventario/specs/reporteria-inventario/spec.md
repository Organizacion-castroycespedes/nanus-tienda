# Delta spec: reporteria-inventario

## ADDED Requirements

### Requirement: Reporte de productos proximos a vencer

`backend-reporteria/` SHALL exponer un reporte de productos/lotes proximos a vencer.

#### Scenario: Consulta autorizada

- GIVEN un usuario autorizado
- WHEN consulta proximos a vencer
- THEN el reporte SHALL devolver producto, lote, sucursal, vencimiento, cantidad y severidad.

#### Scenario: Severidad configurable por tenant

- GIVEN reglas activas de vencimiento para un tenant
- WHEN el reporte calcula productos proximos a vencer
- THEN SHALL usar `inventory_alert_rules` o defaults equivalentes de 7, 15 y 30 dias.

### Requirement: Reporte de productos vencidos

`backend-reporteria/` SHALL exponer un reporte de productos/lotes vencidos.

#### Scenario: Consulta vencidos

- GIVEN lotes vencidos con stock disponible
- WHEN se consulta el reporte
- THEN SHALL devolver lotes vencidos dentro del alcance autorizado.

### Requirement: Reporte de baja rotacion

`backend-reporteria/` SHALL exponer reporte de baja rotacion.

#### Scenario: Periodo definido

- GIVEN un rango de fechas
- WHEN se consulta baja rotacion
- THEN SHALL devolver productos bajo umbral de salida.

PREGUNTA ABIERTA: Umbral de baja rotacion por tenant, categoria o producto?

### Requirement: Reporte de inventario valorizado

`backend-reporteria/` SHALL exponer inventario valorizado.

#### Scenario: Valorizacion

- GIVEN existencias por producto/lote/sucursal
- WHEN se genera reporte valorizado
- THEN SHALL devolver cantidad, costo unitario, valor total y criterio de costo.

#### Scenario: Valorizacion por lote

- GIVEN un producto loteado con saldo disponible
- WHEN se genera inventario valorizado
- THEN SHALL usar `inventory_lots.unit_cost` como costo unitario.

#### Scenario: Valorizacion legacy

- GIVEN un producto no loteado o saldo legacy
- WHEN se genera inventario valorizado
- THEN SHALL usar `products.cost` actual o costo promedio legacy si una migracion futura lo define.

RIESGO: El inventario valorizado no debe recalcular ventas historicas ni cambiar tickets ya emitidos.

### Requirement: Reporte de historial de precios

`backend-reporteria/` SHALL exponer historial de precios.

#### Scenario: Historial por rango

- GIVEN cambios de precio en un rango
- WHEN se consulta historial
- THEN SHALL devolver producto, precio anterior, precio nuevo, motivo, usuario y fecha.

### Requirement: Exportables o PDFs futuros

Los reportes de inventario SHALL soportar JSON y MAY soportar PDF/exportables cuando se apruebe.

#### Scenario: JSON por defecto

- GIVEN una consulta de reporte
- WHEN no se solicita formato PDF
- THEN SHALL devolver JSON normalizado.

#### Scenario: PDF aprobado

- GIVEN un reporte con template PDF
- WHEN `format=pdf`
- THEN SHALL devolver `application/pdf`.

RIESGO: Reporteria no debe ejecutar reglas transaccionales ni modificar inventario.
