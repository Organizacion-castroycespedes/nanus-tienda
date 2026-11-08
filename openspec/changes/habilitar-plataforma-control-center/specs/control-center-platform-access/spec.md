## ADDED Requirements

### Requirement: Acceso exclusivo del SUPER_ADMIN del tenant plataforma

El sistema SHALL permitir operar endpoints bajo `/api/admin/control-center` únicamente a usuarios autenticados con sesión activa cuyo rol `SUPER_ADMIN` esté vigente en base de datos para el tenant plataforma configurado en `PLATFORM_TENANT_ID`.

#### Scenario: SUPER_ADMIN del tenant plataforma

- **WHEN** un usuario activo con rol `SUPER_ADMIN` en el tenant plataforma y sesión activa invoca un endpoint del Control Center
- **THEN** el sistema SHALL procesar la solicitud.

#### Scenario: SUPER_ADMIN asignado en otro tenant

- **WHEN** un usuario con rol `SUPER_ADMIN` cuyo `tenant_id` no es el tenant plataforma invoca un endpoint del Control Center
- **THEN** el sistema SHALL responder 403 sin revelar la causa.

#### Scenario: Rol revocado con token vigente

- **WHEN** un JWT vigente incluye `SUPER_ADMIN` pero el rol fue retirado en `user_roles`
- **THEN** el sistema SHALL responder 403.

#### Scenario: Otros roles

- **WHEN** un usuario `SUPER_USER`, `ADMIN` o `USER` de cualquier tenant invoca un endpoint del Control Center
- **THEN** el sistema SHALL responder 403.

#### Scenario: Sin autenticación

- **WHEN** se invoca un endpoint del Control Center sin token o con una sesión inactiva
- **THEN** el sistema SHALL responder 401.

### Requirement: Cobertura obligatoria de guards

El sistema SHALL rechazar en pruebas automatizadas cualquier controller o handler del módulo `control-center` que no declare `JwtAuthGuard`, `RolesGuard`, `PlatformTenantGuard` y `@Roles("SUPER_ADMIN")`.

#### Scenario: Controller nuevo sin guard

- **WHEN** se agrega un controller al módulo sin la cadena de guards
- **THEN** la prueba de inventario de rutas SHALL fallar.

### Requirement: Visibilidad web

La web SHALL mostrar la entrada y la ruta `/{tenant}/control-center` solo a usuarios SUPER_ADMIN del tenant plataforma, y SHALL tratar cualquier respuesta 401/403 del backend como acceso denegado.

#### Scenario: Usuario de un tenant cliente navega a la ruta

- **WHEN** un usuario de un tenant cliente abre `/{tenant}/control-center`
- **THEN** la web SHALL mostrar la página de no autorizado y no SHALL solicitar datos del Control Center.

### Requirement: Activación segura

El sistema SHALL deshabilitar el módulo y responder `503 CONTROL_CENTER_DISABLED` cuando `CONTROL_CENTER_ENABLED` no sea `true` o falten las credenciales dedicadas, sin afectar el arranque ni otras rutas de la API.

#### Scenario: Credenciales ausentes

- **WHEN** la API arranca sin `CONTROL_CENTER_DB_USERNAME`
- **THEN** la API SHALL iniciar normalmente y los endpoints del Control Center SHALL responder 503.
