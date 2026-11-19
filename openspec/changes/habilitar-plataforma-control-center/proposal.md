## Why

MANUS no tiene cómo administrar la relación comercial con los negocios que contratan el software. El discovery `HU-MANUS-CONTROL-CENTER-000` (HEAD `d10e8875`) encontró cuatro condiciones:

- todo vive en `public` con un único usuario runtime de privilegios amplios (`scripts/database/012_runtime_db_grants.sql`);
- `PermissionsGuard` concede todo a `SUPER_ADMIN` (`permissions.guard.ts:65`), un rol asignable en cualquier tenant;
- los guards no son globales;
- la auditoría existente exige `tenant_id`.

Antes del Control Center comercial se necesita una base segura: un esquema propio, un usuario de BD dedicado, acceso exclusivo del SUPER_ADMIN del tenant plataforma y una auditoría inmutable.

## What Changes

- Crear el esquema `control_center` en la misma base de datos de cada ambiente (QA y PRD tienen Control Center independientes).
- Introducir el rol de grupo `NOLOGIN` `manus_control_center_app` y un usuario `LOGIN` dedicado por ambiente, creados por un runbook operativo fuera del runner. La migración solo otorga privilegios y falla si el rol de grupo no existe.
- Dar al rol dedicado acceso DML a `control_center` y `SELECT` restringido por columnas a `public.tenants`, `public.tenants_detalles`, `public.tenant_branches`, `public.pos_terminals` y `public.taxes` (los impuestos del tenant plataforma configuran el IVA de las suscripciones). Los usuarios runtime de la API operativa no reciben ningún privilegio sobre `control_center`.
- Agregar en `api/` el módulo `control-center` con un pool PostgreSQL propio (`CONTROL_CENTER_DB_*`), deshabilitado de forma segura cuando no está configurado.
- Agregar `PlatformTenantGuard`: exige el rol `SUPER_ADMIN` revalidado en BD y `tenantId` igual a `PLATFORM_TENANT_ID`.
- Agregar `control_center.admin_audit_events`, de solo inserción, con actor, acción, entidad, antes/después, motivo y metadatos de la petición.
- Exponer `GET /api/admin/control-center/readiness` y una ruta web protegida `/{tenant}/control-center` con una pantalla de estado.
- Agregar una prueba que recorra los controllers del módulo y falle si alguno no declara la cadena de guards requerida.

## Capabilities

### New Capabilities

- `control-center-platform-access`: acceso exclusivo del SUPER_ADMIN del tenant plataforma, en backend y web.
- `control-center-data-isolation`: esquema propio, usuario de BD dedicado y privilegios mínimos.
- `control-center-admin-audit`: auditoría administrativa inmutable con motivo obligatorio en operaciones críticas.

### Modified Capabilities

- Ninguna. No cambia el comportamiento de los módulos operativos existentes.

## Impact

- `scripts/database/migrations/V###__control_center_foundation.sql` (número asignado en implementación según la regla de unicidad vigente), más un rollback en `scripts/database/rollbacks/`.
- Nuevo runbook `docs/runbook-control-center-db-role.md` (roles y credenciales por ambiente; sin secretos en el repo).
- `api/src/modules/control-center/**`, `api/src/common/guards/platform-tenant.guard.ts`, `api/src/modules/app.module.ts`, `api/.env.example`.
- `web/app/[tenant]/control-center/**`, `web/modules/control-center/**`.
- `scripts/governance/openspec-scope.json` (ownership de las rutas nuevas).
- Despliegue: variables nuevas en QA y PRD (`CONTROL_CENTER_ENABLED`, `CONTROL_CENTER_DB_USERNAME`, `CONTROL_CENTER_DB_PASSWORD`, `PLATFORM_TENANT_ID`).
- Fuera de alcance: contratos, planes, cobros, correo, WhatsApp, analítica, IA, licenciamiento y suspensiones.
