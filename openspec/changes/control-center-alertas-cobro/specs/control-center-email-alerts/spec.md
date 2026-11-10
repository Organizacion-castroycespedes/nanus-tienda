## ADDED Requirements

### Requirement: Recordatorio por correo con SMTP configurable

El sistema SHALL enviar el recordatorio de la etapa vigente al `billing_email` de la cuenta comercial por el SMTP configurado (`CONTROL_CENTER_SMTP_*`), con asunto y cuerpo en español que incluyan cliente, cargo, período, saldo, vencimiento e instrucciones de pago, cuando `CONTROL_CENTER_ALERTS_EMAIL_ENABLED` sea `true`.

#### Scenario: Correo de vencimiento

- **WHEN** un cargo de $850.000 llega al día de su vencimiento
- **THEN** el sistema SHALL enviar un correo con el asunto de vencimiento, el número de cargo, el saldo y las instrucciones de pago, y registrarlo como `SENT`.

#### Scenario: Contenido escapado

- **WHEN** el nombre de la cuenta contiene caracteres HTML
- **THEN** el cuerpo HTML SHALL mostrarlos escapados.

### Requirement: Reintentos de correo fallido

El sistema SHALL registrar como `FAILED` un envío que falle, con el error, y SHALL reintentarlo en ejecuciones siguientes hasta 3 intentos.

#### Scenario: SMTP caído

- **WHEN** el servidor SMTP rechaza la conexión
- **THEN** el registro SHALL quedar `FAILED` con el error y el siguiente proceso SHALL reintentarlo.

#### Scenario: Tercer intento fallido

- **WHEN** un envío ya falló 3 veces
- **THEN** el sistema no SHALL reintentarlo automáticamente.

### Requirement: Prueba de configuración y recordatorio manual

El sistema SHALL permitir al SUPER_ADMIN enviar un correo de prueba a una dirección indicada y enviar manualmente el recordatorio de un cargo con saldo, y SHALL registrar ambas acciones en la auditoría y el recordatorio en la bitácora.

#### Scenario: Correo de prueba

- **WHEN** el SUPER_ADMIN envía un correo de prueba con el SMTP configurado
- **THEN** el sistema SHALL responder con el resultado del envío sin modificar la cartera.

#### Scenario: Recordatorio de un cargo pagado

- **WHEN** se pide un recordatorio manual de un cargo `PAID`
- **THEN** el sistema SHALL responder 409.
