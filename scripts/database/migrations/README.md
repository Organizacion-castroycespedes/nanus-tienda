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
