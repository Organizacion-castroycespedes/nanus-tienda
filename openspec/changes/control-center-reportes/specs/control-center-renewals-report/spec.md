## ADDED Requirements

### Requirement: Renovaciones y pruebas por vencer

El sistema SHALL listar para una ventana de 30, 60 o 90 días los contratos activos con fin de prueba, fin del término inicial o próxima renovación anual dentro de la ventana, con la fecha, los días restantes, el valor actual y el valor de renovación mensual y anual según el catálogo vigente.

#### Scenario: Fin del término inicial

- **WHEN** un contrato anual cuya facturación inició el 2025-12-08 tiene término inicial de 12 meses y la consulta es del 2026-11-10 con ventana de 30 días
- **THEN** el reporte SHALL incluir el evento de fin de término inicial el 2026-12-08 con 28 días restantes y sus valores de renovación.

#### Scenario: Prueba por terminar

- **WHEN** la prueba de un contrato activo termina dentro de la ventana
- **THEN** el reporte SHALL incluir el evento de fin de prueba.

#### Scenario: Renovación ya registrada

- **WHEN** el contrato ya tiene una versión que rige desde la fecha del evento
- **THEN** el evento SHALL marcarse como renovación registrada.

#### Scenario: Renovación mensual

- **WHEN** la versión vigente es una renovación mensual
- **THEN** el contrato no SHALL aparecer como renovación por vencer.
