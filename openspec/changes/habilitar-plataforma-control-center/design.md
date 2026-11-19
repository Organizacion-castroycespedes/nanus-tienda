## Context

El discovery `HU-MANUS-CONTROL-CENTER-000` estableció el estado actual. Decisiones del propietario (2026-11-07):

- misma base de datos, esquema distinto;
- QA y PRD tienen cada uno su Control Center;
- usuario de BD dedicado;
- acceso exclusivo para SUPER_ADMIN.

Restricciones verificadas:

- runner oficial `scripts/database/apply_single_migration.sh`, gobernanza STRICT con cutover V095, `migrations_history` en `public` y `current_schema()=public`;
- migraciones sin `BEGIN`/`COMMIT`;
- sin ORM; patrón Controller → Service → Repository con `pg`.

## Goals / Non-Goals

**Goals**

- Aislamiento real en BD entre la operación POS y la administración SaaS.
- Acceso imposible para cualquier identidad distinta del SUPER_ADMIN del tenant plataforma.
- Auditoría que no requiera inventar un `tenant_id`.
- Activación segura: si falta configuración, el módulo queda deshabilitado y no rompe la API.

**Non-Goals**

- Entidades comerciales: van en el change `crear-control-center-cuentas-contratos`.
- RLS en `public`.
- Cambiar los guards o el RBAC existentes.
- Servicio de correo.

## Decisions

### D1. Esquema `control_center` creado por migración versionada

Se crea con `CREATE SCHEMA IF NOT EXISTS control_center` y todos los objetos se califican con el esquema. El runner sigue operando con `current_schema()=public` y `migrations_history` no se mueve.

- Alternativa descartada: una base de datos separada. Pierde las FK hacia `public.tenants` y contradice la decisión del propietario.
- **Prerrequisito:** dry-run (`MIGRATION_DRY_RUN=YES`) en LOCAL y diagnóstico STRICT verde con el archivo nuevo. Si la gobernanza rechaza DDL fuera de `public`, el change se bloquea y se abre un change de gobernanza.

### D2. Roles de BD

- `manus_control_center_app` (`NOLOGIN`): rol de grupo que tiene los privilegios.
- `manus_cc_qa` / `manus_cc_prd` (`LOGIN`): miembros del grupo, uno por ambiente.

Los roles son objetos del clúster y llevan credenciales, por eso se crean con el runbook operativo (DBA) y no con el runner. La migración:

1. verifica que exista `manus_control_center_app` y, si no existe, lanza `RAISE EXCEPTION 'CONTROL_CENTER_ROLE_MISSING'`;
2. ejecuta `REVOKE ALL ON SCHEMA control_center FROM PUBLIC`;
3. otorga `USAGE` y DML sobre tablas y secuencias de `control_center` al grupo, más `ALTER DEFAULT PRIVILEGES` del owner de la migración para objetos futuros del esquema;
4. otorga `SELECT` por columnas en `public`:
   - `tenants(id, slug, nombre, activo, created_at)`
   - `tenants_detalles(tenant_id, razon_social, nit, dv, tipo_persona, email_corporativo, telefono, ciudad, departamento, municipio_id, representante_nombre, representante_email, representante_telefono)`. Se excluyen `banco_principal`, `numero_cuenta`, `tipo_cuenta` y `cuenta_contable_defecto`.
   - `tenant_branches(id, tenant_id, nombre, estado, es_principal)`
   - `pos_terminals(id, tenant_id, branch_id, code, name, active)`
   - `taxes(id, tenant_id, name, rate, is_included, is_active)`. El servicio filtra `tenant_id = PLATFORM_TENANT_ID`, porque el IVA de las suscripciones se configura en la tabla de impuestos del tenant plataforma, igual que en la venta POS.
5. no otorga nada a `manus_user` ni a `manus_qa_user` sobre `control_center`.

Para que las FK de fases siguientes a `public.tenants(id)` funcionen, el owner de la migración necesita `REFERENCES` sobre `public.tenants`. Hay que verificarlo en el dry-run.

### D3. Pool dedicado en la API

`ControlCenterDatabaseService` crea un `Pool` con `CONTROL_CENTER_DB_USERNAME`/`CONTROL_CENTER_DB_PASSWORD`; host, puerto, base y SSL se reutilizan de `DB_*`. Configuración del pool:

- `application_name = 'manus-control-center'`;
- `statement_timeout` de 15 s;
- máximo 5 conexiones.

Si `CONTROL_CENTER_ENABLED !== "true"` o faltan credenciales, el módulo responde `503 CONTROL_CENTER_DISABLED` y no abre conexiones. Nunca se usa el `DatabaseService` operativo para leer o escribir `control_center`.

### D4. Cadena de autorización

Cada controller del módulo declara a nivel de clase:

`@Controller("admin/control-center/...") @UseGuards(JwtAuthGuard, RolesGuard, PlatformTenantGuard) @Roles("SUPER_ADMIN")`

`PlatformTenantGuard`:

1. exige `request.user.tenantId === PLATFORM_TENANT_ID` (por defecto el UUID del seed `004_seed_super_admin.sql`);
2. revalida en BD con el pool operativo, en solo lectura, que el usuario está `ACTIVE`, que tiene `user_roles` con `SUPER_ADMIN` en el tenant plataforma y que el tenant plataforma está activo;
3. si algo falla, responde 403 sin revelar el motivo exacto.

Esto evita confiar en roles del JWT que pueden haber quedado obsoletos y en un SUPER_ADMIN asignado en otro tenant.

`PermissionsGuard` no se usa porque haría bypass. La prueba de inventario de rutas recorre los providers del módulo con `Reflector` y falla si algún controller o handler no tiene los tres guards y `@Roles("SUPER_ADMIN")`.

### D5. Auditoría

`control_center.admin_audit_events` tiene las columnas:

- `id`, `occurred_at`
- `actor_user_id`, `actor_tenant_id`
- `action`, `entity_type`, `entity_id`
- `before jsonb`, `after jsonb`
- `reason`, `request_id`, `ip`, `user_agent`

El grupo solo tiene `INSERT` y `SELECT`; no tiene `UPDATE`, `DELETE` ni `TRUNCATE`. Un trigger `BEFORE UPDATE OR DELETE` lanza una excepción como defensa adicional.

`ControlCenterAuditService.record(tx, event)` escribe dentro de la misma transacción de la operación de negocio, de modo que la operación y su auditoría confirman o fallan juntas. Las acciones críticas exigen un `reason` de al menos 10 caracteres. La lista de acciones críticas la mantienen los changes de cada fase.

### D6. Web

Ruta `/{tenant}/control-center`, visible solo si el perfil tiene `SUPER_ADMIN` y su tenant es el tenant plataforma (el valor llega desde la API vía `GET readiness` o desde `/auth/me`). La pantalla muestra el estado de readiness: módulo habilitado, esquema presente, rol conectado y versión de la migración.

La seguridad no depende de la web. Para el menú se agrega un ítem solo en el tenant plataforma mediante un seed funcional versionado incluido en la misma migración, sin tocar los menús de otros tenants.

## Risks / Trade-offs

- **La gobernanza no acepta DDL fuera de `public`.** Mitigación: dry-run previo; si falla, se bloquea el change.
- **El rol de grupo no existe en un ambiente y la migración falla.** Es intencional (fail-fast) y está documentado en el runbook.
- **La consulta extra por request en `PlatformTenantGuard`.** El volumen es bajo (solo administración), así que es aceptable.
- **El UUID del tenant plataforma puede diferir por ambiente.** Por eso es configurable en `PLATFORM_TENANT_ID`, y el readiness verifica que el tenant exista.

## Migration Plan

1. El DBA crea los roles por ambiente con el runbook y guarda las credenciales en secretos.
2. Dry-run de la migración en LOCAL, luego aplicación en LOCAL.
3. Despliegue de la API con `CONTROL_CENTER_ENABLED=false`.
4. Migración en QA.
5. Activación del flag en QA y verificación del readiness.
6. El mismo proceso en PRD.

**Rollback:** desactivar el flag. La migración de rollback revoca privilegios y elimina el esquema solo si no tiene datos de negocio.

## Open Questions

- ¿El usuario que aplica migraciones en QA/PRD tiene `REFERENCES` sobre `public.tenants` y permisos para `ALTER DEFAULT PRIVILEGES`?
- ¿`/auth/me` ya expone el `tenant_id` para que la web decida la visibilidad, o hay que derivarlo del readiness?
