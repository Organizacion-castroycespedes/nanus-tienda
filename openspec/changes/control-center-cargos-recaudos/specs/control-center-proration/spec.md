## ADDED Requirements

### Requirement: Prorrateo diario por enmienda

Cuando un contrato con política de prorrateo `DAILY` se enmienda con fecha dentro de un período ya cobrado, el sistema SHALL calcular la diferencia entre el valor de la frecuencia en la versión nueva y en la anterior, multiplicada por los días restantes del período sobre sus días totales y redondeada a pesos.

#### Scenario: Terminal adicional a mitad del año

- **WHEN** un contrato anual con período del 2027-01-15 al 2028-01-14 agrega el 2027-07-15 una terminal anual de $350.000
- **THEN** el sistema SHALL generar un cargo `PRORATION` por $350.000 × 184/365 redondeado a pesos, con vencimiento 2027-07-15, y líneas que guarden el factor de días.

#### Scenario: Reducción del valor

- **WHEN** la enmienda reduce el valor del período
- **THEN** el sistema SHALL crear un crédito `PRORATION_CREDIT` por el valor proporcional y aplicarlo a los cargos abiertos del mismo contrato empezando por el más antiguo.

#### Scenario: Política sin prorrateo

- **WHEN** el contrato tiene política `NONE`
- **THEN** no SHALL generarse prorrateo y el cambio SHALL regir desde el siguiente período.

### Requirement: Cargos futuros reemplazados por la enmienda

El sistema SHALL anular automáticamente, con el motivo "Reemplazado por enmienda", los cargos de período generados por anticipado que inicien en o después de la fecha de la enmienda, y SHALL rechazar la enmienda si alguno de esos cargos tiene pagos aplicados.

#### Scenario: Cargo anticipado sin pagos

- **WHEN** existe un cargo generado por anticipado para el próximo período y se enmienda el contrato antes de su inicio
- **THEN** ese cargo SHALL quedar `VOID` y el siguiente cálculo SHALL usar la versión nueva.

#### Scenario: Cargo anticipado con pago aplicado

- **WHEN** el cargo anticipado tiene un pago aplicado
- **THEN** la enmienda SHALL rechazarse con 409 indicando que se reviertan primero las aplicaciones.

### Requirement: Enmienda atómica con prorrateo

El sistema SHALL confirmar en una sola transacción la nueva versión del contrato, el cargo o crédito de prorrateo, la anulación de cargos futuros y los eventos de auditoría, y SHALL deshacer todo si cualquiera de esos pasos falla.

#### Scenario: Falla al crear el cargo de prorrateo

- **WHEN** falla la creación del cargo de prorrateo durante una enmienda
- **THEN** no SHALL quedar creada la nueva versión del contrato ni ningún cargo anulado.
