# Incremental Migrations

Todas las nuevas migraciones incrementales y overrides de funciones post-base deben crearse aqui.
Este directorio es la fuente de verdad para cambios SQL nuevos que deban entrar por `migrate_prd.sh`.

Formato de nombre para nuevas migraciones:

- `V###__description.sql`

Compatibilidad legacy:

- `YYYYMMDD_description.sql`

Ejemplos:

- `V046__reports_module.sql`
- `V047__alter_sales_add_status.sql`

Tipos permitidos:

- `ALTER TABLE`
- `CREATE TABLE`
- `CREATE FUNCTION`
- `UPDATE` de datos controlado

Reglas:

- No editar migraciones ya aplicadas en PRD.
- Una responsabilidad clara por archivo.
- Toda migracion debe ser idempotente cuando sea razonable.
- Si una migracion ya existe en `public.migrations_history`, no se modifica: cualquier cambio va en una nueva migracion.
- Las migraciones post-cutover no deben contener `BEGIN`, `START TRANSACTION`, `COMMIT`, `END`, `ROLLBACK`, `ABORT`, `SAVEPOINT` o `RELEASE`; `scripts/database/apply_single_migration.sh` es el unico propietario de la frontera transaccional junto con `public.migrations_history`.
- El runner acepta `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`; `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD` son aliases opcionales con precedencia explicita cuando existen. La configuracion valida nombres, no certifica privilegios.
