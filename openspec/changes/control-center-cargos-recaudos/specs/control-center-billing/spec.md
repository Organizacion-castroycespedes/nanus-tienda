## ADDED Requirements

### Requirement: Cargos por período sin duplicados

El sistema SHALL generar para cada contrato `ACTIVE` un cargo por cada período de cada frecuencia de sus ítems (mensual, anual o único), a partir del fin de la prueba o del inicio de facturación, con vencimiento el día de inicio del período, y SHALL garantizar en base de datos un solo cargo no anulado por contrato, tipo, frecuencia e inicio de período.

#### Scenario: Primer cargo después de la prueba

- **WHEN** un contrato anual inicia el 2026-12-15 con prueba hasta el 2027-01-15
- **THEN** el primer cargo anual SHALL tener período 2027-01-15 a 2028-01-14 y vencer el 2027-01-15.

#### Scenario: Ejecución repetida

- **WHEN** el proceso de generación se ejecuta dos veces el mismo día para el mismo contrato
- **THEN** SHALL existir un solo cargo por período.

#### Scenario: Ejecución en paralelo

- **WHEN** el worker y el botón manual generan cargos del mismo contrato al mismo tiempo
- **THEN** SHALL quedar un solo cargo por período y la otra ejecución SHALL omitirlo sin error.

#### Scenario: Corte a fin de mes

- **WHEN** un contrato mensual tiene inicio de facturación el 2027-01-31
- **THEN** los períodos SHALL iniciar el 2027-02-28, el 2027-03-31 y el 2027-04-30.

### Requirement: Montos y snapshot de la versión

Cada cargo SHALL tomar las líneas, los precios, los descuentos y el impuesto de la versión del contrato vigente al inicio del período, y SHALL guardar subtotal, base, impuesto y total en pesos sin usar aritmética de punto flotante.

#### Scenario: Plan anual con IVA incluido

- **WHEN** se genera el cargo anual de un contrato de $850.000 con IVA 19% incluido y certificación bonificada
- **THEN** el cargo SHALL tener total $850.000, base $714.286 e IVA $135.714, e incluir la línea de certificación con descuento total.

#### Scenario: Renovación mensual con certificación anual

- **WHEN** un contrato en renovación mensual tiene la certificación anual cobrada aparte
- **THEN** SHALL generarse un cargo mensual por el plan y un cargo anual por la certificación en su aniversario.

#### Scenario: Cargo de valor cero

- **WHEN** un cargo resulta con total 0
- **THEN** el cargo SHALL registrarse en estado `PAID`.

### Requirement: Generación automática y manual

El sistema SHALL generar automáticamente los cargos cuyo inicio esté dentro de la ventana de anticipación configurada (`CONTROL_CENTER_BILLING_LEAD_DAYS`, 5 días por defecto) cuando `CONTROL_CENTER_BILLING_WORKER_ENABLED` sea `true`, y SHALL permitir al SUPER_ADMIN forzar la generación de un contrato desde su ficha con el mismo cálculo.

#### Scenario: Worker deshabilitado

- **WHEN** `CONTROL_CENTER_BILLING_WORKER_ENABLED` no es `true`
- **THEN** el sistema no SHALL generar cargos automáticamente, y el botón manual SHALL seguir funcionando.

#### Scenario: Contrato terminado

- **WHEN** un contrato terminó el 2027-06-30
- **THEN** no SHALL generarse ningún cargo de período que inicie después de esa fecha.

#### Scenario: Bitácora de ejecución

- **WHEN** el worker termina una ejecución
- **THEN** SHALL registrar en `billing_runs` los contratos revisados, los cargos creados y los errores.

### Requirement: Anulación de contrato registrado por error

El sistema SHALL permitir al SUPER_ADMIN anular un contrato `ACTIVE` registrado por error, con motivo de al menos 10 caracteres, solo si ninguno de sus cargos tiene pagos aplicados. La anulación SHALL anular los cargos del contrato y sus créditos de prorrateo sin aplicar, dejar el contrato en `CANCELLED` con su historial y liberar el tenant para un contrato nuevo, sin modificar los pagos registrados a la cuenta.

#### Scenario: Contrato con datos equivocados sin pagos aplicados

- **WHEN** el SUPER_ADMIN anula con motivo un contrato activo cuyos cargos no tienen pagos aplicados
- **THEN** el contrato SHALL quedar `CANCELLED`, sus cargos `VOID` y el tenant SHALL aceptar un contrato nuevo.

#### Scenario: Contrato con pagos aplicados

- **WHEN** alguno de los cargos del contrato tiene pagos aplicados
- **THEN** el sistema SHALL responder 409 indicando que se reviertan primero las aplicaciones.

#### Scenario: Saldo a favor de la cuenta

- **WHEN** la cuenta tiene un pago sin aplicar y se anula el contrato
- **THEN** el pago SHALL conservarse como saldo a favor para aplicarlo a los cargos del contrato nuevo.
