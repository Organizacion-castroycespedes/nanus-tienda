# Runbook de Base de Datos (Windows, Linux y macOS)

Este runbook describe como ejecutar migraciones, seeds, backup, rollback y despliegue remoto SSH usando los scripts en `scripts/`.

## 1. Requisitos

- PostgreSQL client instalado (`psql`, `pg_dump`, `pg_restore`).
- Bash disponible:
  - Windows: Git Bash o WSL.
  - Linux/macOS: bash nativo.
- Acceso de red al servidor PostgreSQL.
- Usuario con permisos de aplicacion (`DB_USER`) y, para crear base automaticamente, usuario admin (`DB_ADMIN_USER`) con permiso `CREATEDB`.

## 2. Configuracion de variables

1. Crear archivo real de entorno:
   - Copiar `scripts/config/db.env.example` a `scripts/config/db.env`.
2. Ajustar al menos:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ENVIRONMENT`
   - `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` (recomendado para creacion automatica de base).
3. Para deploy remoto SSH, configurar ademas:
   - `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_REMOTE_DIR`

## 3. Flujo recomendado

Orden sugerido:
1. `migrate.sh` (crea DB si no existe + schema/versionado)
2. `seed.sh` (solo datos iniciales/controlados)
3. `backup.sh` antes de cambios mayores
4. `rollback.sh` solo si hay incidente
5. runners modulares por dominio cuando aplique:
   - `products/run_all.sh`
   - `sale/run_sales_migrations.sh`
   - `finance/run_finance_migrations.sh`

## 3.1 Convencion de ubicacion y nombres

Todo script SQL nuevo debe vivir en `scripts/database/` y registrarse aqui antes de usarse.

Estructura canonica para finanzas:

```txt
scripts/database/
  finance/
    migrations/
    seeds/
    patches/
    views/
```

Convencion de nombre obligatoria:

```txt
YYYYMMDD_HHMM_module_description.sql
```

Orden logico por tipo:
1. enums
2. tablas
3. indices
4. constraints
5. seeds
6. updates
7. fixes

## 4. Ejecucion en Windows

## Opcion A: Git Bash (recomendada)

Desde la raiz `apps`:

```bash
bash scripts/database/migrate.sh scripts/config/db.env
bash scripts/database/seed.sh scripts/config/db.env
bash scripts/database/products/run_all.sh scripts/config/db.env
bash scripts/database/sale/run_sales_migrations.sh scripts/config/db.env
bash scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```

Backup:

```bash
bash scripts/database/backup.sh scripts/config/db.env
```

Rollback:

```bash
bash scripts/database/rollback.sh scripts/database/backups/<archivo>.dump
```

Deploy remoto por SSH:

```bash
bash scripts/ssh/deploy-db.sh scripts/config/db.env
```

## Opcion B: PowerShell + bash

Si `bash` esta en PATH:

```powershell
bash scripts/database/migrate.sh scripts/config/db.env
bash scripts/database/seed.sh scripts/config/db.env
bash scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```

## 5. Ejecucion en Linux

Desde la raiz `apps`:

```bash
chmod +x scripts/database/*.sh scripts/ssh/*.sh
./scripts/database/migrate.sh scripts/config/db.env
./scripts/database/seed.sh scripts/config/db.env
./scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```

Backup:

```bash
./scripts/database/backup.sh scripts/config/db.env
```

Deploy remoto:

```bash
./scripts/ssh/deploy-db.sh scripts/config/db.env
```

## 6. Ejecucion en macOS

Mismo flujo que Linux:

```bash
chmod +x scripts/database/*.sh scripts/ssh/*.sh
./scripts/database/migrate.sh scripts/config/db.env
./scripts/database/seed.sh scripts/config/db.env
./scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```

## 7. Que hace cada script

- `scripts/database/migrate.sh`
  - valida variables.
  - crea la base `DB_NAME` si no existe (usando `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD`).
  - ejecuta migraciones `001_*.sql`, `002_*.sql` (omite seeds).
  - registra estado en `public.migrations_history`.
- `scripts/database/seed.sh`
  - ejecuta:
    - `005_seed_general_data.sql` (datos generales completos desde dump)
    - `006_seed_menu_items.sql` (menu inicial)
    - `003_seed_roles.sql`
    - `007_seed_role_menu_permissions.sql` (permisos RBAC por menu)
    - `004_seed_super_admin.sql`
  - todo idempotente.
- `scripts/database/backup.sh`
  - genera backup custom `.dump` con timestamp.
- `scripts/database/rollback.sh`
  - restaura un `.dump` con `pg_restore --clean --if-exists`.
- `scripts/database/finance/run_finance_migrations.sh`
  - aplica los scripts financieros registrados en orden canonico.
  - separa migraciones estructurales (`migrations/`) de ajustes sobre tablas existentes (`patches/`).
- `scripts/ssh/deploy-db.sh`
  - verifica si DB existe.
  - si existe, crea backup.
  - ejecuta migraciones.
  - ejecuta seed solo si entorno nuevo.
  - genera log en `scripts/ssh/logs/`.

## 8. Comandos utiles de verificacion

Verificar tablas core:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt public.*"
```

Ver historial de migraciones:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version, applied_at, success FROM public.migrations_history ORDER BY applied_at DESC;"
```

Ver usuario super admin:

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tenant_id, email, estado FROM public.users ORDER BY created_at DESC LIMIT 5;"
```

## 9. Troubleshooting rapido

- Error de permisos al crear DB:
  - usar `DB_ADMIN_USER` con permiso `CREATEDB`.
- Error `psql: command not found`:
  - instalar PostgreSQL client y reabrir terminal.
- Error de conexion:
  - validar `DB_HOST`, `DB_PORT`, firewall y `pg_hba.conf`.
- Encoding raro en datos geograficos:
  - asegurar terminal en UTF-8 y cliente PostgreSQL UTF8.

## 10. Que pasa si ejecuto todo completo

Si ejecutas:

```bash
./scripts/database/migrate.sh scripts/config/db.env && ./scripts/database/seed.sh scripts/config/db.env
```

Resultado esperado:
- Si la DB no existe, se crea automaticamente.
- Se aplican migraciones estructurales (`001`, `002`) y se registran en `migrations_history`.
- Se cargan/actualizan datos generales (paises, departamentos, municipios, tenant base, detalles, sucursal y personas).
- Se carga menu inicial (`menu_items`) con estructura padre/hijo.
- Se cargan roles base y permisos por rutas.
- Se cargan `role_menu_permissions` para `SUPER_ADMIN` segun matriz inicial.
- Se crea/actualiza usuario super admin y su relacion en `user_roles`.

Comportamiento idempotente:
- No duplica registros por re-ejecucion.
- Si un registro ya existe, lo actualiza segun `ON CONFLICT`.

## 11. Catalogo de scripts financieros

Todos los scripts financieros vigentes quedaron registrados en `scripts/database/finance/`.

| Orden | Script | Tipo | Modulo | Proposito | Dependencias | Descripcion breve |
|---|---|---|---|---|---|---|
| 1 | `scripts/database/finance/migrations/20260430_1753_finance_base_infrastructure.sql` | `migrations` | `finance` | Crear infraestructura base de caja y metodos de pago | Requiere esquema core ya aplicado: `tenants`, `tenant_branches`, `terminals`, `users` | Crea `payment_methods`, `cash_registers`, `cash_sessions` y `cash_movements` con indices y constraints base. |
| 2 | `scripts/database/finance/migrations/20260430_1947_finance_payments_engine.sql` | `migrations` | `finance` | Crear motor de pagos transversal | Depende de `20260430_1753_finance_base_infrastructure.sql` | Amplia `cash_movements` para `PAYMENT` y crea `payments` y `payment_allocations` con sus indices y checks. |
| 3 | `scripts/database/finance/patches/20260430_1956_finance_payment_integration.sql` | `patches` | `finance` | Integrar estados y saldos de pago sobre ventas, compras y pedidos | Depende de `20260430_1753_finance_base_infrastructure.sql`, `20260430_1947_finance_payments_engine.sql` y de los modulos `products` + `sale` ya aplicados | Agrega `payment_status`, `total_paid` y `balance_due` a `sales`, `purchases` y `orders`, migra datos iniciales y crea indices de consulta. |

Orden de ejecucion del modulo:
1. `migrations/20260430_1753_finance_base_infrastructure.sql`
2. `migrations/20260430_1947_finance_payments_engine.sql`
3. `patches/20260430_1956_finance_payment_integration.sql`

Comando recomendado:

```bash
bash scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```
