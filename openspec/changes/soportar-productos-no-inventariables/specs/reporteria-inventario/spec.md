## MODIFIED Requirements

### Requirement: Reporte de inventario valorizado

El sistema SHALL permitir consultar inventario valorizado y SHALL distinguir productos no inventariables como `NOT_APPLICABLE`, excluyendolos de existencias y valorizacion fisica.

#### Scenario: Valorizacion por sucursal

- **WHEN** se genera reporte valorizado con existencias por producto, lote o sucursal
- **THEN** el sistema SHALL calcular cantidad, costo unitario de criterio aprobado y valor total solo para productos inventariables.

#### Scenario: Servicio en reporte fisico

- **WHEN** un producto no inventariable aparece en una consulta de inventario
- **THEN** el sistema SHALL devolver `NOT_APPLICABLE` o excluirlo segun el contrato, SHALL no mostrarlo como `OUT_OF_STOCK` y SHALL no sumarlo a valorizacion fisica.

## ADDED Requirements

### Requirement: Estado de inventariabilidad en reportes

Los reportes de inventario y BI SHALL exponer el estado de inventariabilidad o una clasificacion equivalente, respetando tenant y sucursal autorizada.

#### Scenario: Reporte comercial con servicio

- **WHEN** se consulta un reporte comercial de ventas
- **THEN** las ventas de servicios SHALL estar incluidas con precios, impuestos, descuentos y pagos.

#### Scenario: Filtro de stock

- **WHEN** se filtra por stock bajo, agotado, lote o FEFO
- **THEN** los productos no inventariables SHALL quedar fuera o identificados como `NOT_APPLICABLE`, nunca como agotados.

#### Scenario: Aislamiento

- **WHEN** un usuario consulta reportes
- **THEN** las filas SHALL limitarse al tenant y a las sucursales autorizadas.
