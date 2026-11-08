# Runbook: roles de base de datos del MANUS Control Center

OpenSpec: `habilitar-plataforma-control-center` · Migración: `V111__control_center_foundation.sql`

Este runbook lo ejecuta el DBA **antes** de aplicar V111 en cada ambiente. Los roles son objetos del clúster y llevan credenciales, por eso no los crea el runner de migraciones. No guardes contraseñas en el repositorio.

## Modelo

| Rol | Tipo | Uso |
|---|---|---|
| `manus_control_center_app` | `NOLOGIN` | Rol de grupo. Recibe todos los privilegios del Control Center (V111). |
| `manus_cc_local` / `manus_cc_qa` / `manus_cc_prd` | `LOGIN` | Usuario de conexión de la API para el Control Center en cada ambiente. Miembro del grupo. |

Reglas:

- El usuario runtime de la API operativa (`manus_user`, `manus_qa_user`, etc.) **no** debe ser miembro de `manus_control_center_app` ni dueño del esquema `control_center`.
- El usuario que aplica migraciones es el dueño de los objetos de `control_center`. Si en un ambiente ese usuario es el mismo que el runtime de la API, el aislamiento se rompe: el endpoint de readiness lo reporta como `operationalRoleHasSchemaAccess=true` y el estado queda `DEGRADED`.

## 1. Crear el rol de grupo (una vez por clúster)

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_control_center_app') THEN
    CREATE ROLE manus_control_center_app NOLOGIN;
  END IF;
END $$;
```

## 2. Crear el usuario de conexión del ambiente

Reemplaza `<ambiente>` (`local`, `qa`, `prd`) y genera una contraseña fuerte fuera del repositorio (gestor de secretos).

```sql
CREATE ROLE manus_cc_<ambiente> LOGIN PASSWORD '<contraseña-generada>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
GRANT manus_control_center_app TO manus_cc_<ambiente>;
ALTER ROLE manus_cc_<ambiente> SET search_path = control_center, public;
GRANT CONNECT ON DATABASE <base_del_ambiente> TO manus_cc_<ambiente>;
```

El usuario hereda los privilegios del grupo (`INHERIT`); la API no ejecuta `SET ROLE`.

## 3. Verificar antes de migrar

```sql
SELECT rolname, rolcanlogin FROM pg_roles
WHERE rolname IN ('manus_control_center_app', 'manus_cc_<ambiente>');

-- El runtime operativo no debe pertenecer al grupo:
SELECT pg_has_role('<usuario_runtime_api>', 'manus_control_center_app', 'MEMBER');  -- esperado: false
```

## 4. Aplicar V111

Con el runner oficial y primero en modo dry-run:

```bash
MIGRATION_DRY_RUN=YES bash scripts/database/apply_single_migration.sh scripts/database/migrations/V111__control_center_foundation.sql
```

Si el rol de grupo no existe, la migración falla con `CONTROL_CENTER_ROLE_MISSING` sin dejar cambios.

## 5. Configurar la API

Variables por ambiente (en secretos, no en el repo):

```
CONTROL_CENTER_ENABLED=true
CONTROL_CENTER_DB_USERNAME=manus_cc_<ambiente>
CONTROL_CENTER_DB_PASSWORD=<contraseña-generada>
PLATFORM_TENANT_ID=00000000-0000-0000-0000-000000000001
```

Host, puerto, base y SSL se reutilizan de `DB_*`. Con `CONTROL_CENTER_ENABLED` distinto de `true` o sin credenciales, el módulo responde `503 CONTROL_CENTER_DISABLED` y no abre conexiones.

## 6. Verificación posterior

`GET /api/admin/control-center/readiness` con un SUPER_ADMIN del tenant plataforma debe responder `status: "READY"`.

## Rotación de credenciales

```sql
ALTER ROLE manus_cc_<ambiente> PASSWORD '<nueva-contraseña>';
```

Actualiza el secreto `CONTROL_CENTER_DB_PASSWORD` y reinicia la API.

## Rollback

`scripts/database/rollbacks/V111__control_center_foundation_rollback.sql` elimina el esquema solo si no tiene tablas de negocio ni eventos de auditoría. Los roles se eliminan manualmente:

```sql
DROP ROLE IF EXISTS manus_cc_<ambiente>;
DROP ROLE IF EXISTS manus_control_center_app;  -- solo si ningún ambiente del clúster lo usa
```
