# Incremental Migrations

Todas las nuevas migraciones incrementales y overrides de funciones post-base deben crearse aqui.
Este directorio es la fuente de verdad para cambios SQL nuevos que deban entrar por `migrate_prd.sh`.

Formato de nombre:

- `YYYYMMDD_description.sql`

Ejemplos:

- `20260503_add_payment_table.sql`
- `20260503_alter_sales_add_status.sql`

Tipos permitidos:

- `ALTER TABLE`
- `CREATE TABLE`
- `CREATE FUNCTION`
- `UPDATE` de datos controlado

Reglas:

- No editar migraciones ya aplicadas en PRD.
- Una responsabilidad clara por archivo.
- Toda migracion debe ser idempotente cuando sea razonable.
