## ADDED Requirements

### Requirement: Etapas de recordatorio por cargo

El sistema SHALL calcular para cada cargo con saldo la etapa vigente según los días respecto al vencimiento en hora de Bogotá (`UPCOMING` desde 5 días antes, `DUE` el día del vencimiento y `OVERDUE_1`, `OVERDUE_7`, `OVERDUE_15` y `OVERDUE_30` en mora) y SHALL enviar solo la etapa vigente si no se ha enviado antes por ese canal.

#### Scenario: Aviso previo

- **WHEN** un cargo con saldo vence el 2026-12-08 y el proceso corre el 2026-12-03
- **THEN** el sistema SHALL registrar la etapa `UPCOMING` para ese cargo.

#### Scenario: Etapas atrasadas no se envían en ráfaga

- **WHEN** el proceso no corrió durante 10 días y un cargo tiene 8 días de mora
- **THEN** el sistema SHALL enviar solo `OVERDUE_7` y no las etapas `UPCOMING`, `DUE` ni `OVERDUE_1`.

#### Scenario: Cargo sin saldo

- **WHEN** un cargo está `PAID` o `VOID`
- **THEN** el sistema no SHALL enviar recordatorios de ese cargo.

#### Scenario: Después de 30 días

- **WHEN** un cargo tiene 45 días de mora y ya se envió `OVERDUE_30`
- **THEN** el proceso automático no SHALL enviar más recordatorios de ese cargo.

### Requirement: Idempotencia y bitácora de alertas

El sistema SHALL registrar cada alerta automática en `control_center.billing_alerts` y SHALL garantizar en base de datos un solo registro automático por cargo, etapa y canal, aunque el proceso corra varias veces o en varias instancias.

#### Scenario: Proceso repetido el mismo día

- **WHEN** el proceso de alertas corre dos veces el mismo día
- **THEN** cada cargo SHALL tener a lo sumo un registro automático por etapa y canal.

#### Scenario: Canal apagado

- **WHEN** el correo está deshabilitado o sin configuración
- **THEN** la etapa de correo SHALL quedar `SKIPPED` con el motivo y el aviso del dashboard SHALL publicarse igual.

### Requirement: Proceso automático y ejecución manual

El sistema SHALL ejecutar las alertas después de cada generación automática de cargos cuando `CONTROL_CENTER_ALERTS_ENABLED` sea `true`, y SHALL permitir al SUPER_ADMIN ejecutarlas manualmente desde Cartera con el mismo cálculo.

#### Scenario: Alertas deshabilitadas

- **WHEN** `CONTROL_CENTER_ALERTS_ENABLED` no es `true`
- **THEN** el worker no SHALL enviar alertas y la ejecución manual SHALL seguir disponible.
