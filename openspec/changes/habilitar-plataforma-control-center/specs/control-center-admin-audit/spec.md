## ADDED Requirements

### Requirement: Auditoría administrativa inmutable

El sistema SHALL registrar cada operación de escritura del Control Center en `control_center.admin_audit_events`, en la misma transacción que la operación, con actor, tenant del actor, acción, tipo y ID de entidad, estado anterior, estado posterior, motivo cuando aplique, identificador de petición, IP, user agent y fecha.

#### Scenario: Operación exitosa

- **WHEN** una operación de escritura del Control Center se confirma
- **THEN** SHALL existir exactamente un evento de auditoría asociado en la misma transacción.

#### Scenario: Operación fallida

- **WHEN** una operación de escritura falla y se revierte
- **THEN** no SHALL persistir el evento de auditoría de esa operación.

#### Scenario: Intento de alterar la auditoría

- **WHEN** cualquier usuario de aplicación intenta ejecutar `UPDATE` o `DELETE` sobre `admin_audit_events`
- **THEN** PostgreSQL SHALL rechazar la operación.

### Requirement: Motivo obligatorio en operaciones críticas

El sistema SHALL exigir un motivo de al menos 10 caracteres para las acciones declaradas como críticas y SHALL rechazar la solicitud con 400 si falta.

#### Scenario: Acción crítica sin motivo

- **WHEN** el SUPER_ADMIN ejecuta una acción crítica sin motivo
- **THEN** el sistema SHALL responder 400 y no SHALL modificar datos.
