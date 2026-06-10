# Spec: reporteria-inventario

## Proposito

Definir comportamiento esperado para reportes futuros de inventario desde `backend-reporteria/`.

SUPUESTO: Los reportes usaran el patron actual: funcion SQL consolidada, adapter, service, controller y PDF/exportable opcional.

## Requirements

### Requirement: Reporte de productos proximos a vencer

El sistema SHALL permitir consultar productos/lotes proximos a vencer.

#### Scenario: Consultar proximos a vencer

- GIVEN lotes con fecha de vencimiento dentro de la ventana configurada
- WHEN el usuario consulta el reporte
- THEN el sistema SHALL devolver producto, lote, sucursal, vencimiento, cantidad y severidad.

#### Scenario: Filtro por tenant/sucursal

- GIVEN un usuario con alcance de sucursal
- WHEN consulta el reporte
- THEN el sistema SHALL limitar resultados a su tenant y sucursales autorizadas.

### Requirement: Reporte de productos vencidos

El sistema SHALL permitir consultar productos/lotes vencidos.

#### Scenario: Consultar vencidos

- GIVEN lotes con fecha de vencimiento anterior a la fecha operativa
- WHEN el usuario consulta el reporte
- THEN el sistema SHALL devolver producto, lote, sucursal, vencimiento y cantidad disponible vencida.

### Requirement: Reporte de baja rotacion

El sistema SHALL permitir consultar productos de baja rotacion.

#### Scenario: Baja rotacion por periodo

- GIVEN un periodo de analisis
- WHEN el usuario consulta baja rotacion
- THEN el sistema SHALL devolver productos con salidas menores al umbral definido.

PREGUNTA ABIERTA: El umbral de baja rotacion sera global, por tenant, por categoria o por producto?

### Requirement: Reporte de inventario valorizado

El sistema SHALL permitir consultar inventario valorizado.

#### Scenario: Valorizacion por sucursal

- GIVEN existencias por producto/lote/sucursal
- WHEN se genera reporte valorizado
- THEN el sistema SHALL calcular cantidad, costo unitario de criterio aprobado y valor total.

PREGUNTA ABIERTA: El costo valorizado sera ultimo costo, promedio ponderado, costo por lote o FEFO?

### Requirement: Reporte de historial de precios

El sistema SHALL permitir consultar historial de cambios de precios.

#### Scenario: Historial por producto

- GIVEN un producto con cambios de precio
- WHEN se consulta reporte de historial
- THEN el sistema SHALL devolver precio anterior, precio nuevo, motivo, usuario y fecha.

#### Scenario: Historial por rango

- GIVEN un rango de fechas
- WHEN se consulta historial de precios
- THEN el sistema SHALL devolver cambios dentro del rango y alcance autorizado.

### Requirement: Exportables o PDFs futuros

El sistema SHALL permitir generar exportables o PDFs para reportes de inventario cuando el alcance lo apruebe.

#### Scenario: Reporte JSON

- GIVEN un reporte de inventario
- WHEN `format` no es PDF
- THEN el sistema SHALL devolver JSON normalizado.

#### Scenario: Reporte PDF

- GIVEN un reporte de inventario con `format=pdf`
- WHEN el reporte tiene template aprobado
- THEN `backend-reporteria/` SHALL devolver `application/pdf`.

PREGUNTA ABIERTA: Se requiere CSV/XLS ademas de PDF?

## Riesgos

RIESGO: Reporteria no debe duplicar reglas transaccionales. Solo debe leer datos ya consolidados.

RIESGO: Reportes grandes de inventario pueden requerir paginacion o exportacion asincrona.

