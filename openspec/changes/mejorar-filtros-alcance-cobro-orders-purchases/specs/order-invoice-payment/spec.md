## ADDED Requirements

### Requirement: Pagos al facturar solo con saldo pendiente
Al facturar un pedido, la sección "Pagos nuevos" SHALL mostrarse solo si el total a facturar supera los abonos heredados, y SHALL NOT mostrarse cuando los abonos cubren el total.

#### Scenario: Pedido totalmente abonado
- **WHEN** los abonos heredados cubren el total a facturar
- **THEN** no se muestra "Pagos nuevos" y se puede facturar directamente

#### Scenario: Pedido con saldo
- **WHEN** el total a facturar es mayor que los abonos heredados
- **THEN** se muestra "Pagos nuevos" con el saldo y el botón "Registrar pago"

### Requirement: Cobro con el modal moderno de abonos
El cobro del saldo al facturar SHALL hacerse con el mismo modal de cobro de la acción "Abonar", con el saldo de la facturación como monto sugerido y máximo, y el pago SHALL registrarse como abono del pedido que la factura hereda.

#### Scenario: Registrar el pago del saldo
- **WHEN** el usuario presiona "Registrar pago" y confirma un pago por el saldo
- **THEN** el pago queda como abono del pedido, aparece en "Caja y abonos heredados" y el saldo por cubrir queda en 0

#### Scenario: Pago parcial del saldo
- **WHEN** el usuario registra un pago menor al saldo
- **THEN** el saldo por cubrir se reduce en ese valor y "Pagos nuevos" sigue visible

#### Scenario: Cancelar el modal
- **WHEN** el usuario cierra el modal sin registrar el pago
- **THEN** no se registra ningún pago y la facturación sigue igual

### Requirement: Cobertura de ventas CASH
Una facturación CASH SHALL quedar cubierta totalmente por abonos heredados antes de enviarse; una facturación CREDIT SHALL poder enviarse con saldo pendiente.

#### Scenario: CASH con saldo
- **WHEN** el tipo es CASH y queda saldo por cubrir
- **THEN** "Facturar" no se envía y se indica registrar el pago del saldo

#### Scenario: CREDIT con saldo
- **WHEN** el tipo es CREDIT y queda saldo por cubrir
- **THEN** la factura se envía y el saldo queda pendiente en la venta
