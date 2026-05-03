# Runbook de Base de Datos

Este runbook describe cómo operar la base de datos del proyecto en entorno local, en despliegues PRD mínimos y en futuras migraciones incrementales post-PRD.

## 1. Requisitos

- PostgreSQL client instalado: `psql`, `pg_dump`, `pg_restore`
- Bash disponible
  - Windows: Git Bash o WSL
  - Linux/macOS: bash nativo
- acceso de red al servidor PostgreSQL
- archivo de variables de entorno para DB

## 2. Variables de entorno

Los runners usan estas variables:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Algunos scripts históricos también pueden usar:

- `DB_ADMIN_USER`
- `DB_ADMIN_PASSWORD`
- `ENVIRONMENT`

Archivo sugerido:

- `scripts/config/db.env`

## 3. Estructura actual y objetivo

Estructura actual del repositorio:

```text
scripts/database/
  finance/
  products/
  sale/
  001_initial_schema.sql
  002_extensions.sql
  003_seed_roles.sql
  ...
```

Estructura objetivo post-PRD para cambios nuevos:

```text
scripts/database/
  base/
  migrations/
  seeds/
```

Reglas:

- no eliminar ni reescribir la historia actual
- no modificar scripts antiguos ya aplicados en PRD
- toda modificación nueva debe entrar por `scripts/database/migrations`

## 4. Tabla de control de migraciones

La tabla real de control usada hoy por los runners es:

```sql
CREATE TABLE public.migrations_history (
  id bigserial NOT NULL,
  version text NOT NULL,
  applied_at timestamptz DEFAULT now() NOT NULL,
  applied_by text DEFAULT CURRENT_USER NOT NULL,
  checksum text NULL,
  success bool DEFAULT true NOT NULL,
  details text NULL,
  CONSTRAINT migrations_history_pkey PRIMARY KEY (id),
  CONSTRAINT migrations_history_version_key UNIQUE (version)
);
```

Nota:

- en algunos equipos se habla de `schema_migrations` como concepto
- en este proyecto la tabla efectiva y ya integrada es `public.migrations_history`

## 5. Cómo levantar entorno local

### Flujo recomendado

1. crear o ajustar `scripts/config/db.env`
2. ejecutar esquema base
3. ejecutar seeds/módulos necesarios según el caso

### Opción rápida para entorno histórico/local

```bash
bash scripts/database/migrate.sh scripts/config/db.env
```

Ese runner:

- crea la base si no existe
- crea `migrations_history`
- aplica migraciones estructurales históricas del root
- omite seeds detectados por nombre

### Cargar datos y módulos históricos

Si el ambiente local necesita catálogos base y estructura antigua completa:

```bash
bash scripts/database/seed.sh scripts/config/db.env
bash scripts/database/products/run_all.sh scripts/config/db.env
bash scripts/database/sale/run_sales_migrations.sh scripts/config/db.env
bash scripts/database/finance/run_finance_migrations.sh scripts/config/db.env
```

### Verificación básica local

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt public.*"
```

## 6. Cómo ejecutar PRD

Para despliegue productivo mínimo, usar:

```bash
sh scripts/database/migrate_prd.sh scripts/config/db.env
```

O si ya estás dentro de `scripts/database`:

```bash
sh migrate_prd.sh ../config/db.env
```

### Qué hace `migrate_prd.sh`

- valida `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- asegura `public.migrations_history`
- aplica en orden:
  - schema/core
  - módulos históricos requeridos
  - funciones
  - seed mínimo PRD
- registra checksum, éxito y detalle en `migrations_history`

### Qué sí incluye

- schema completo necesario
- tablas
- índices
- constraints
- funciones/procedimientos SQL existentes
- usuarios demo operativos y sus roles base
- seed mínimo de `CONSUMIDOR FINAL`

### Qué no incluye

- productos demo
- proveedores demo
- clientes demo masivos

## 7. Seed mínimo de consumidor final

Archivo:

- `scripts/database/011_prd_default_customer.sql`

Qué hace:

- agrega `is_default` a `customers` si no existe
- crea índice único parcial por tenant para un solo cliente default
- inserta `CONSUMIDOR FINAL` por tenant si aún no existe uno marcado como default

Características:

- idempotente
- compatible con el esquema real del proyecto

## 8. Cómo aplicar nuevas migraciones post-PRD

Todas las migraciones nuevas deben crearse en:

- `scripts/database/migrations/YYYYMMDD_description.sql`

Ejemplos:

- `20260503_add_payment_table.sql`
- `20260503_alter_sales_add_status.sql`

### Runner incremental

Ejecutar:

```bash
sh scripts/database/run_migrations.sh scripts/config/db.env
```

O desde `scripts/database`:

```bash
sh run_migrations.sh ../config/db.env
```

### Qué hace `run_migrations.sh`

- asegura `public.migrations_history`
- recorre `scripts/database/migrations`
- ejecuta solo archivos no registrados como exitosos
- registra:
  - `version`
  - `checksum`
  - `success`
  - `details`

### Patrón de archivos aceptado

```text
YYYYMMDD_description.sql
```

## 9. Tipos de migraciones permitidas

Para post-PRD, las migraciones nuevas deben limitarse a cambios controlados como:

- `ALTER TABLE`
- `CREATE TABLE`
- `CREATE FUNCTION`
- `UPDATE` de datos controlado

Recomendación adicional:

- usar `IF NOT EXISTS` cuando aplique
- usar `ON CONFLICT` en seeds o data-fixes idempotentes

## 10. Buenas prácticas

- no editar scripts antiguos ya aplicados
- usar migraciones incrementales en `scripts/database/migrations`
- probar primero en staging
- respaldar antes de tocar PRD
- dejar una sola responsabilidad por archivo
- registrar siempre la lógica SQL nueva dentro de `scripts/database`
- si el cambio es de datos, hacerlo de forma controlada e idempotente

## 11. Comandos útiles

### Ver historial

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version, applied_at, success, details FROM public.migrations_history ORDER BY applied_at DESC;"
```

### Ver cliente default por tenant

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tenant_id, name, document_number, is_default FROM public.customers WHERE is_default = true;"
```

### Ver usuarios demo operativos

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tenant_id, email, estado FROM public.users WHERE email LIKE '%@manustienda.local' ORDER BY tenant_id, email;"
```

## 12. Troubleshooting rápido

- `psql: command not found`
  - instalar PostgreSQL client y reabrir terminal
- error de conexión
  - validar `DB_HOST`, `DB_PORT`, firewall y `pg_hba.conf`
- migración marcada fallida
  - revisar `migrations_history.details`
  - corregir el SQL con un archivo nuevo; no editar el ya aplicado en PRD
- caracteres raros
  - asegurar UTF-8 en terminal y cliente PostgreSQL

## 13. Resumen operativo

### Local histórico

```bash
sh scripts/database/migrate.sh scripts/config/db.env
```

### PRD mínimo

```bash
sh scripts/database/migrate_prd.sh scripts/config/db.env
```

### Futuras migraciones incrementales

```bash
sh scripts/database/run_migrations.sh scripts/config/db.env
```
