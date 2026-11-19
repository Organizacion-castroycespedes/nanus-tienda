## ADDED Requirements

### Requirement: Recordatorios por WhatsApp con consentimiento

El sistema SHALL enviar por WhatsApp Cloud API la plantilla aprobada de la etapa vigente al teléfono E.164 de la cuenta comercial en los mismos momentos del correo, solo si la cuenta tiene `whatsapp_opt_in` y el canal está habilitado y configurado, y SHALL registrar cada envío en `billing_alerts` con canal `WHATSAPP` una sola vez por cargo y etapa.

#### Scenario: Cuenta con consentimiento

- **WHEN** un cargo de una cuenta con consentimiento y teléfono llega al día de su vencimiento
- **THEN** el sistema SHALL enviar la plantilla de vencimiento con cliente, cargo, saldo y fecha, y registrarla como `SENT`.

#### Scenario: Cuenta sin consentimiento

- **WHEN** la cuenta no tiene `whatsapp_opt_in`
- **THEN** la alerta de WhatsApp SHALL quedar `SKIPPED` con el motivo y el correo y el aviso del dashboard SHALL enviarse igual.

#### Scenario: Canal apagado

- **WHEN** `CONTROL_CENTER_WHATSAPP_ENABLED` no es `true` o falta configuración
- **THEN** el sistema no SHALL llamar a la API de Meta y la etapa SHALL quedar `SKIPPED`.

#### Scenario: Error de Meta

- **WHEN** la API de Meta responde con error
- **THEN** la alerta SHALL quedar `FAILED` con el código y el mensaje del error, sin el token, y SHALL reintentarse hasta 3 veces.

### Requirement: Prueba y recordatorio manual por WhatsApp

El sistema SHALL permitir al SUPER_ADMIN enviar un mensaje de prueba a un número E.164 y enviar el recordatorio de un cargo con saldo eligiendo el canal, y SHALL auditar ambas acciones.

#### Scenario: Recordatorio manual por WhatsApp

- **WHEN** el SUPER_ADMIN envía el recordatorio de un cargo por WhatsApp a una cuenta con consentimiento
- **THEN** el sistema SHALL enviar la plantilla de la etapa vigente y registrarla con `trigger_source = MANUAL`.

#### Scenario: Número inválido en la prueba

- **WHEN** el número de prueba no está en formato E.164
- **THEN** el sistema SHALL responder 400 sin llamar a Meta.
