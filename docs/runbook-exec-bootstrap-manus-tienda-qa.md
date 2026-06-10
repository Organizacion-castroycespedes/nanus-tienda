# Runbook ejecucion bootstrap `manus_tienda_qa`

Estado: plan operativo. No ejecutado por Codex.

Resultado objetivo despues de ejecucion humana aprobada: `QA_DB_BOOTSTRAP_READY`.

## Objetivo

Preparar la ejecucion real del bootstrap de la base QA aislada `manus_tienda_qa`, usando backups ya confirmados y el wrapper seguro `scripts/database/bootstrap-manus-tienda-qa.sh`.

## Estado previo requerido

- `QA_AWS_DEPLOY_READY`
- `QA_BOOTSTRAP_MANIFEST_READY`
- `QA_BACKUP_CONFIRMED`
- Snapshot Lightsail: `castroycespedes-pre-manus-tienda-qa-bootstrap-20260610`
- Backup root: `/home/ubuntu/backups/manus-qa/20260610-0030`
- Dump DB: `/home/ubuntu/backups/manus-qa/20260610-0030/db/manus_tienda.dump`
- `pg_restore -l` del dump: OK
- Backup Nginx: confirmado
- Backup PM2: confirmado
- Backup env: confirmado
- Env real QA fuera de git: `scripts/database/config/bootstrap-manus-tienda-qa.env`

## Prohibido en esta fase documental

- No ejecutar bootstrap.
- No crear `manus_tienda_qa`.
- No ejecutar migraciones.
- No desplegar.
- No reiniciar.
- No modificar PM2.
- No modificar Nginx.
- No tocar PRD.

## Prerequisitos de ejecucion humana

- Operador con acceso SSH aprobado a QA AWS.
- Ventana de ejecucion aprobada.
- Snapshot y backups confirmados.
- `scripts/database/config/bootstrap-manus-tienda-qa.env` existe fuera de git.
- `git check-ignore` confirma que el env real no se versiona.
- El env real conserva `CONFIRM_CREATE_QA_DB=NO` antes de iniciar la ventana.
- El env real conserva `APPLY_OPTIONAL_FIXTURES=NO` salvo aprobacion explicita para fixtures demo.
- No hay deploy simultaneo.
- No hay migracion simultanea.

## Variables requeridas

El archivo real `scripts/database/config/bootstrap-manus-tienda-qa.env` debe contener valores reales fuera de docs y fuera de git.

Variables obligatorias:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manus_tienda_qa
DB_OWNER=manus_qa_user
DB_ADMIN_USER=postgres
DB_ADMIN_PASSWORD=<secret-outside-repo>
DB_APP_PASSWORD=<secret-outside-repo>
ENVIRONMENT=qa
SEED_SUPER_ADMIN_EMAIL=<secret-or-approved-qa-value>
SEED_SUPER_ADMIN_PASSWORD=<secret-outside-repo>
SEED_SUPER_ADMIN_FIRST_NAME=<qa-value>
SEED_SUPER_ADMIN_LAST_NAME=<qa-value>
CONFIRM_CREATE_QA_DB=NO
APPLY_OPTIONAL_FIXTURES=NO
RUN_SMOKE_SQL=YES
LOG_DIR=./logs
```

Confirmaciones de objetivo:

- Usuario app/owner objetivo: `manus_qa_user`.
- Base objetivo: `manus_tienda_qa`.
- Historial: `public.migrations_history`.
- Migraciones obligatorias: `V053`, `V054`.
- Seeds minimos: tenant/sucursal, roles, usuarios QA, menu, permisos/RBAC, consumidor final, metodos de pago, terminal POS y peripheral settings MOCK.
- Fixture `migrations/20260505_reporting_pos_fixtures.sql`: opcional. No corre con `APPLY_OPTIONAL_FIXTURES=NO`.
- Patch legacy `migrations/20260505_sync_local_to_aws_reporting_and_sales.sql`: obligatorio, pero debe ser idempotente en DB limpia. Validar que sus `DROP FUNCTION` usen `IF EXISTS`.

## Validaciones previas

Ejecutar manualmente en el servidor QA, desde la raiz del repo remoto.

```bash
pwd
git status --short
test -f scripts/database/bootstrap-manus-tienda-qa.sh
test -f scripts/database/bootstrap-manus-tienda-qa.manifest.md
test -f scripts/database/config/bootstrap-manus-tienda-qa.env
git check-ignore -v scripts/database/config/bootstrap-manus-tienda-qa.env
```

Validar env sin imprimir secretos:

```bash
grep '^DB_HOST=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^DB_PORT=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^DB_NAME=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^DB_OWNER=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^DB_ADMIN_USER=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^ENVIRONMENT=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^CONFIRM_CREATE_QA_DB=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^APPLY_OPTIONAL_FIXTURES=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^RUN_SMOKE_SQL=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^LOG_DIR=' scripts/database/config/bootstrap-manus-tienda-qa.env
```

Validar target exacto:

```bash
test "$(grep '^DB_NAME=' scripts/database/config/bootstrap-manus-tienda-qa.env | cut -d= -f2-)" = "manus_tienda_qa"
test "$(grep '^DB_OWNER=' scripts/database/config/bootstrap-manus-tienda-qa.env | cut -d= -f2-)" = "manus_qa_user"
test "$(grep '^CONFIRM_CREATE_QA_DB=' scripts/database/config/bootstrap-manus-tienda-qa.env | cut -d= -f2-)" = "NO"
```

Validar backups:

```bash
export BACKUP_ROOT="/home/ubuntu/backups/manus-qa/20260610-0030"
test -d "$BACKUP_ROOT"
test -s "$BACKUP_ROOT/db/manus_tienda.dump"
pg_restore -l "$BACKUP_ROOT/db/manus_tienda.dump" > "$BACKUP_ROOT/logs/manus_tienda.dump.pre-bootstrap-check.txt"
test -s "$BACKUP_ROOT/logs/manus_tienda.dump.pre-bootstrap-check.txt"
test -e "$BACKUP_ROOT/nginx/nginx"
test -s "$BACKUP_ROOT/pm2/pm2-list.txt"
test -s "$BACKUP_ROOT/pm2/api-linux.txt"
test -s "$BACKUP_ROOT/pm2/backend-reporteria-linux.txt"
test -s "$BACKUP_ROOT/env/db.env.bak"
```

Validar que la DB destino no exista aun:

```bash
sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'manus_tienda_qa';"
```

Resultado esperado antes de bootstrap: salida vacia.

## Preparar env de ejecucion

No editar el env real versionado fuera de git para poner `YES`. Crear copia temporal dentro del backup root.

```bash
export BACKUP_ROOT="/home/ubuntu/backups/manus-qa/20260610-0030"
export RUN_ENV="$BACKUP_ROOT/env/bootstrap-manus-tienda-qa.run.env"
cp scripts/database/config/bootstrap-manus-tienda-qa.env "$RUN_ENV"
chmod 600 "$RUN_ENV"
sed -i 's/^CONFIRM_CREATE_QA_DB=.*/CONFIRM_CREATE_QA_DB=YES/' "$RUN_ENV"
grep '^DB_NAME=' "$RUN_ENV"
grep '^DB_OWNER=' "$RUN_ENV"
grep '^CONFIRM_CREATE_QA_DB=' "$RUN_ENV"
```

Confirmar manualmente:

- `DB_NAME=manus_tienda_qa`
- `DB_OWNER=manus_qa_user`
- `CONFIRM_CREATE_QA_DB=YES`
- `APPLY_OPTIONAL_FIXTURES=NO`

## Comando exacto de bootstrap

Ejecutar solo con aprobacion humana explicita.

```bash
bash scripts/database/bootstrap-manus-tienda-qa.sh "$RUN_ENV"
```

El script debe:

- validar env externo;
- rechazar example env;
- validar manifiesto;
- requerir `CONFIRM_CREATE_QA_DB=YES`;
- rechazar DB distinta a `manus_tienda_qa`;
- rechazar `manus_tienda`;
- llamar `scripts/database/migrate_prd.sh`;
- aplicar schema/base, funciones, migraciones y seeds minimos;
- saltar fixtures QA opcionales por defecto;
- ejecutar smoke SQL si `RUN_SMOKE_SQL=YES`;
- escribir log en `LOG_DIR`.

## Validacion posterior

Ejecutar en servidor QA despues de que el script termine con exit code 0.

Conectar como usuario app:

```bash
source "$RUN_ENV"
export PGPASSWORD="$DB_APP_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "SELECT current_database(), current_user;"
```

Validar `migrations_history`:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT COUNT(*) AS failed_migrations
FROM public.migrations_history
WHERE success IS NOT TRUE;
"
```

Resultado esperado: `0`.

Validar `V053` y `V054`:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT version, success
FROM public.migrations_history
WHERE version IN (
  'migrations/V053__products_sale_model_phase_11_1.sql',
  'migrations/V054__pos_terminal_peripheral_settings_phase_12.sql'
)
ORDER BY version;
"
```

Resultado esperado: dos filas con `success = true`.

## Smoke SQL

Validar tablas core:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT
  to_regclass('public.tenants') AS tenants,
  to_regclass('public.tenant_branches') AS tenant_branches,
  to_regclass('public.roles') AS roles,
  to_regclass('public.menu_items') AS menu_items,
  to_regclass('public.role_menu_permissions') AS role_menu_permissions,
  to_regclass('public.users') AS users,
  to_regclass('public.customers') AS customers,
  to_regclass('public.pos_terminals') AS pos_terminals,
  to_regclass('public.pos_terminal_peripheral_settings') AS pos_terminal_peripheral_settings;
"
```

Validar seeds minimos:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT 'tenants' AS item, COUNT(*) FROM public.tenants
UNION ALL SELECT 'tenant_branches', COUNT(*) FROM public.tenant_branches
UNION ALL SELECT 'roles', COUNT(*) FROM public.roles
UNION ALL SELECT 'menu_items', COUNT(*) FROM public.menu_items
UNION ALL SELECT 'role_menu_permissions', COUNT(*) FROM public.role_menu_permissions
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'pos_terminals', COUNT(*) FROM public.pos_terminals
UNION ALL SELECT 'pos_terminal_peripheral_settings', COUNT(*) FROM public.pos_terminal_peripheral_settings;
"
```

Validar modelo de productos pesables:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('sale_type', 'measurement_unit');
"
```

Validar terminal settings MOCK:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_OWNER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -c "
SELECT
  pt.code,
  pt.mode,
  s.printer_device_id,
  s.cash_drawer_device_id,
  s.scale_device_id,
  s.scanner_device_id
FROM public.pos_terminals pt
LEFT JOIN public.pos_terminal_peripheral_settings s ON s.terminal_id = pt.id
ORDER BY pt.created_at
LIMIT 5;
"
```

## Rollback

Como `manus_tienda_qa` es una base nueva aislada, el rollback normal ante fallo es:

1. No apuntar API/Web a `manus_tienda_qa`.
2. Conservar `manus_tienda` sin cambios.
3. Conservar snapshot y dump.
4. Guardar logs de bootstrap.
5. Diagnosticar causa.

Si se requiere eliminar `manus_tienda_qa`, debe ser aprobacion humana explicita. Comandos destructivos, no ejecutar sin aprobacion:

```bash
sudo -u postgres psql -d postgres -c "REVOKE CONNECT ON DATABASE manus_tienda_qa FROM public;"
sudo -u postgres psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'manus_tienda_qa';"
sudo -u postgres dropdb manus_tienda_qa
```

Restauracion desde snapshot Lightsail queda como rollback mayor si el host queda comprometido.

## Criterios `QA_DB_BOOTSTRAP_READY`

Declarar `QA_DB_BOOTSTRAP_READY` solo si:

- `bash scripts/database/bootstrap-manus-tienda-qa.sh "$RUN_ENV"` termina con exit code 0.
- `manus_tienda_qa` existe.
- `manus_qa_user` puede conectar a `manus_tienda_qa`.
- `public.migrations_history` existe.
- No hay migraciones con `success=false`.
- `V053__products_sale_model_phase_11_1.sql` aparece con `success=true`.
- `V054__pos_terminal_peripheral_settings_phase_12.sql` aparece con `success=true`.
- Tablas core existen.
- Seeds minimos tienen filas.
- Terminal POS default y peripheral settings MOCK existen.
- El log de bootstrap queda guardado.
- `manus_tienda` no fue modificada.
- No se hizo deploy.
- No se reinicio servidor.

## Evidencia requerida despues de ejecucion

Registrar salidas sanitizadas:

- Comando ejecutado sin secretos.
- Ruta `RUN_ENV` sin contenido.
- Log path de bootstrap.
- Resultado exit code.
- Resultado `current_database(), current_user`.
- Resultado `failed_migrations = 0`.
- Resultado V053/V054.
- Smoke SQL de tablas core.
- Conteos de seeds minimos.
- Confirmacion de no deploy, no reinicio, no PRD.
