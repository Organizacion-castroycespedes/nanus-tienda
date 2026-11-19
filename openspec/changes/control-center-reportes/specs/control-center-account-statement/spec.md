## ADDED Requirements

### Requirement: Estado de cuenta en PDF

El sistema SHALL generar para una cuenta comercial y un rango de fechas un PDF con los datos del emisor y del cliente, los cargos que vencen en el rango y todos los cargos con saldo, los pagos y créditos del rango, y un resumen con facturado, pagado, saldo pendiente, vencido y saldo a favor, y SHALL auditar la descarga.

#### Scenario: Rango por defecto

- **WHEN** el SUPER_ADMIN descarga el estado de cuenta sin indicar fechas
- **THEN** el documento SHALL cubrir los últimos 12 meses hasta hoy e incluir además los cargos pendientes anteriores.

#### Scenario: Cargo vencido

- **WHEN** la cuenta tiene un cargo con saldo vencido hace 40 días
- **THEN** el estado de cuenta SHALL mostrarlo con su saldo, el estado vencido y los días de mora, y sumarlo en el total vencido.

#### Scenario: Rango inválido

- **WHEN** la fecha inicial es posterior a la final o el rango supera 36 meses
- **THEN** el sistema SHALL responder 400.

### Requirement: Envío del estado de cuenta por correo

El sistema SHALL enviar el estado de cuenta como adjunto PDF al correo de facturación de la cuenta por el SMTP configurado y SHALL auditar el envío con su resultado.

#### Scenario: Envío exitoso

- **WHEN** el SUPER_ADMIN envía el estado de cuenta y el correo está configurado
- **THEN** el cliente SHALL recibir un correo con el PDF adjunto y el sistema SHALL registrar `ACCOUNT_STATEMENT_SENT`.

#### Scenario: Correo no disponible

- **WHEN** el canal de correo no está configurado o la cuenta no tiene un correo válido
- **THEN** el sistema SHALL responder 422 sin intentar el envío.
