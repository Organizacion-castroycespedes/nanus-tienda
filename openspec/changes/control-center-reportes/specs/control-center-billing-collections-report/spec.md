## ADDED Requirements

### Requirement: Facturado frente a recaudado por mes

El sistema SHALL calcular para un rango de hasta 24 meses, por cada mes, lo facturado según el mes de vencimiento de los cargos no anulados, lo recaudado según el mes de pago de los recaudos confirmados con su desglose por medio de pago, los créditos de prorrateo y la diferencia, además de los totales del rango.

#### Scenario: Cargo anual pagado al mes siguiente

- **WHEN** un cargo de $850.000 vence en noviembre y se paga en diciembre
- **THEN** el reporte SHALL mostrar $850.000 facturados en noviembre y $850.000 recaudados en diciembre.

#### Scenario: Recaudo por medio de pago

- **WHEN** en un mes hay pagos por transferencia y por efectivo
- **THEN** el mes SHALL mostrar el total recaudado y el total de cada medio.

#### Scenario: Anulados

- **WHEN** un cargo o un pago está anulado
- **THEN** no SHALL sumarse en el reporte.

#### Scenario: Rango excesivo

- **WHEN** el rango supera 24 meses
- **THEN** el sistema SHALL responder 400.

### Requirement: Exportación a Excel

El sistema SHALL exportar el reporte a un archivo .xlsx con las hojas Resumen mensual, Cargos y Pagos, con formato de moneda y filtros, y SHALL auditar la exportación.

#### Scenario: Descarga del Excel

- **WHEN** el SUPER_ADMIN exporta el reporte de un rango
- **THEN** el sistema SHALL devolver un archivo .xlsx cuyas sumas coinciden con los totales en pantalla.
