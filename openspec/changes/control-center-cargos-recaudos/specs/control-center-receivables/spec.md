## ADDED Requirements

### Requirement: Cartera por cuenta y tramos de mora

El sistema SHALL mostrar al SUPER_ADMIN, por cuenta comercial y en total, el saldo abierto, el saldo vencido por tramos de días desde el vencimiento (1-30, 31-60, 61-90 y más de 90, en hora de Bogotá), el saldo a favor y los cargos que vencen en los próximos 15 días.

#### Scenario: Cargo vencido hace 40 días

- **WHEN** un cargo con saldo $850.000 venció hace 40 días
- **THEN** su saldo SHALL sumarse al tramo de 31-60 días de su cuenta y del total.

#### Scenario: Saldo a favor

- **WHEN** una cuenta tiene un recaudo con valor sin aplicar
- **THEN** la cartera SHALL mostrarlo como saldo a favor sin restarlo automáticamente de otros cargos.

### Requirement: Anulación de cargos

El sistema SHALL permitir anular un cargo solo con motivo de al menos 10 caracteres y solo si no tiene aplicaciones activas, conservándolo con estado `VOID` y permitiendo regenerar el período.

#### Scenario: Cargo con pagos

- **WHEN** se intenta anular un cargo con pagos aplicados
- **THEN** el sistema SHALL responder 409 indicando que se reviertan primero.

#### Scenario: Regenerar después de anular

- **WHEN** se anula un cargo de período y se ejecuta la generación
- **THEN** el sistema SHALL crear un nuevo cargo para ese período.
