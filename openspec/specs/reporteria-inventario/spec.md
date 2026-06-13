# reporteria-inventario Specification

## Purpose

Definir comportamiento esperado para reportes futuros de inventario desde `backend-reporteria/`.

Supuesto heredado: los reportes usaran el patron actual de funcion SQL consolidada, adapter, service, controller y PDF o exportable opcional.

Preguntas abiertas heredadas:

- El umbral de baja rotacion puede ser global, por tenant, por categoria o por producto.
- El costo valorizado puede requerir definicion entre ultimo costo, promedio ponderado, costo por lote o FEFO.
- Puede requerirse CSV o XLS ademas de PDF.

Riesgos heredados:

- Reporteria no debe duplicar reglas transaccionales. Solo debe leer datos ya consolidados.
- Reportes grandes de inventario pueden requerir paginacion o exportacion asincrona.
## Requirements
### Requirement: Reporte de productos proximos a vencer

El sistema SHALL permitir consultar productos o lotes proximos a vencer.

#### Scenario: Consultar proximos a vencer

- **WHEN** el usuario consulta el reporte para lotes con fecha de vencimiento dentro de la ventana configurada
- **THEN** el sistema SHALL devolver producto, lote, sucursal, vencimiento, cantidad y severidad.

#### Scenario: Filtro por tenant/sucursal

- **WHEN** un usuario con alcance de sucursal consulta el reporte
- **THEN** el sistema SHALL limitar resultados a su tenant y sucursales autorizadas.

### Requirement: Reporte de productos vencidos

El sistema SHALL permitir consultar productos o lotes vencidos.

#### Scenario: Consultar vencidos

- **WHEN** el usuario consulta vencidos para lotes con fecha de vencimiento anterior a la fecha operativa
- **THEN** el sistema SHALL devolver producto, lote, sucursal, vencimiento y cantidad disponible vencida.

### Requirement: Reporte de baja rotacion

El sistema SHALL permitir consultar productos de baja rotacion.

#### Scenario: Baja rotacion por periodo

- **WHEN** el usuario consulta baja rotacion para un periodo de analisis
- **THEN** el sistema SHALL devolver productos con salidas menores al umbral definido.

### Requirement: Reporte de inventario valorizado

El sistema SHALL permitir consultar inventario valorizado.

#### Scenario: Valorizacion por sucursal

- **WHEN** se genera reporte valorizado con existencias por producto, lote o sucursal
- **THEN** el sistema SHALL calcular cantidad, costo unitario de criterio aprobado y valor total.

### Requirement: Reporte de historial de precios

El sistema SHALL permitir consultar historial de cambios de precios.

#### Scenario: Historial por producto

- **WHEN** se consulta reporte de historial para un producto con cambios de precio
- **THEN** el sistema SHALL devolver precio anterior, precio nuevo, motivo, usuario y fecha.

#### Scenario: Historial por rango

- **WHEN** se consulta historial de precios con un rango de fechas
- **THEN** el sistema SHALL devolver cambios dentro del rango y alcance autorizado.

### Requirement: Exportables o PDFs futuros

El sistema SHALL permitir generar exportables o PDFs para reportes de inventario cuando el alcance lo apruebe.

#### Scenario: Reporte JSON

- **WHEN** se solicita un reporte de inventario sin `format=pdf`
- **THEN** el sistema SHALL devolver JSON normalizado.

#### Scenario: Reporte PDF

- **WHEN** se solicita un reporte de inventario con `format=pdf` y el reporte tiene template aprobado
- **THEN** `backend-reporteria/` SHALL devolver `application/pdf`.

