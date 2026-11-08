## ADDED Requirements

### Requirement: Cuenta comercial

El sistema SHALL permitir crear, consultar, actualizar e inactivar cuentas comerciales con tipo y número de identificación únicos, razón social, correo de facturación, contacto y teléfono WhatsApp con registro explícito de consentimiento.

#### Scenario: Identificación duplicada

- **WHEN** se crea una cuenta con un tipo y número de identificación ya registrados
- **THEN** el sistema SHALL rechazarla con 409.

#### Scenario: WhatsApp sin consentimiento

- **WHEN** se registra un teléfono WhatsApp sin marcar el consentimiento
- **THEN** el sistema SHALL guardar `whatsapp_opt_in=false` y no SHALL considerar ese teléfono apto para mensajes futuros.

### Requirement: Vínculo con tenants existentes

El sistema SHALL vincular una cuenta comercial con uno o varios tenants existentes en `public.tenants` y SHALL garantizar que cada tenant tenga como máximo un vínculo `ACTIVE`.

#### Scenario: Tenant ya vinculado a otra cuenta

- **WHEN** se intenta vincular un tenant que tiene vínculo `ACTIVE` con otra cuenta
- **THEN** el sistema SHALL rechazar la operación con 409.

#### Scenario: Tenant inexistente

- **WHEN** se intenta vincular un `tenant_id` que no existe
- **THEN** el sistema SHALL rechazar la operación y no SHALL crear el tenant.

#### Scenario: Desvincular con contrato vigente

- **WHEN** se intenta finalizar el vínculo de un tenant con un contrato `ACTIVE`
- **THEN** el sistema SHALL rechazar la operación hasta que el contrato termine.

#### Scenario: Desvincular con motivo

- **WHEN** el SUPER_ADMIN finaliza un vínculo sin contrato vigente e indica un motivo
- **THEN** el sistema SHALL marcarlo `ENDED`, conservar el historial y auditar la acción.
