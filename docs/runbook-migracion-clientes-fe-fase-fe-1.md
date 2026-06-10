# Runbook migracion clientes FE - Fase FE-1

## Objetivo

Preparar la tabla `customers` para clientes/adquirientes de facturacion electronica futura en Colombia, sin romper el cliente operativo actual.

La migracion:

- Agrega campos fiscales opcionales a `customers`.
- Crea el catalogo versionable `dian_document_types`.
- Crea trazabilidad resumida en `dian_acquirer_lookup_logs`.
- Mantiene `/api/customers`, ventas, pedidos, POS y reportes compatibles.
- No crea tabla paralela de clientes.
- No guarda raw response DIAN/proveedor completo.

Archivos:

- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql`
- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql`

## Precondiciones

1. Confirmar que se ejecuta en ambiente permitido, no PRD.
2. Confirmar que existe tabla `public.customers`.
3. Confirmar que `public.customers` tiene `tenant_id` e `is_active`.
4. Confirmar que no hay mas de un consumidor final activo por tenant antes de crear el indice unico.
5. Confirmar ventana de mantenimiento si el ambiente tiene alto trafico POS.
6. Confirmar backup reciente y restaurable.
7. Confirmar que no se ejecutan backend build, frontend build, tests ni comandos remotos en esta fase.

## Backup

Antes de ejecutar en un ambiente no productivo con datos importantes:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backup_pre_fe_1.dump
```

Validar que el backup existe y tiene tamano mayor a cero:

```bash
ls -lh backup_pre_fe_1.dump
```

Para restaurar en base temporal:

```bash
createdb manus_tienda_restore_check
pg_restore --dbname=manus_tienda_restore_check backup_pre_fe_1.dump
```

## Validacion PostgreSQL previa

Ver version:

```sql
SELECT version();
```

Ver tablas base:

```sql
SELECT to_regclass('public.customers') AS customers_table;
SELECT to_regclass('public.tenants') AS tenants_table;
SELECT to_regclass('public.users') AS users_table;
```

Ver columnas base requeridas:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('id', 'tenant_id', 'name', 'document_number', 'is_active', 'is_default')
ORDER BY column_name;
```

Buscar duplicados que bloquearian consumidor final unico:

```sql
SELECT tenant_id, count(*) AS active_final_consumers
FROM public.customers
WHERE is_active = true
  AND is_default = true
GROUP BY tenant_id
HAVING count(*) > 1;
```

Debe devolver cero filas.

## Ejecucion de migracion

No ejecutar contra PRD en esta fase.

En ambiente permitido:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql
```

## Verificar columnas

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN (
    'document_type_code',
    'document_number_normalized',
    'verification_digit',
    'legal_name',
    'fiscal_email',
    'is_final_consumer',
    'dian_last_lookup_at',
    'dian_last_lookup_status',
    'fiscal_status'
  )
ORDER BY column_name;
```

Esperado:

- Todas las columnas aparecen.
- `is_final_consumer` es `boolean` con default `false`.
- `fiscal_status` es `text` con default `'PENDING'`.
- `fiscal_email` permite null.
- `document_type_code` permite null.

Ver constraints:

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.customers'::regclass
  AND conname IN (
    'chk_customers_fiscal_status',
    'chk_customers_dian_last_lookup_status'
  )
ORDER BY conname;
```

## Verificar tablas

```sql
SELECT to_regclass('public.dian_document_types') AS dian_document_types;
SELECT to_regclass('public.dian_acquirer_lookup_logs') AS dian_acquirer_lookup_logs;
```

Ver estructura de catalogo:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dian_document_types'
ORDER BY ordinal_position;
```

Ver estructura de logs:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dian_acquirer_lookup_logs'
ORDER BY ordinal_position;
```

Confirmar que no se sembraron tipos DIAN todavia:

```sql
SELECT count(*) AS document_type_rows
FROM public.dian_document_types;
```

Esperado en FE-1: `0`, salvo que otro cambio posterior haya sembrado catalogo.

## Verificar indices

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_customers_tenant_document_number_normalized',
    'ux_customers_tenant_active_final_consumer',
    'ux_dian_document_types_country_code_code',
    'idx_dian_acquirer_lookup_logs_tenant_customer',
    'idx_dian_acquirer_lookup_logs_tenant_looked_up_at'
  )
ORDER BY indexname;
```

Ver consumidor final unico activo por tenant:

```sql
SELECT tenant_id, count(*) AS active_final_consumers
FROM public.customers
WHERE is_final_consumer = true
  AND is_active = true
GROUP BY tenant_id
HAVING count(*) > 1;
```

Debe devolver cero filas.

## Validacion de compatibilidad `/api/customers`

La migracion no cambia columnas existentes ni elimina datos usados por `/api/customers`.

Ver muestra de columnas operativas:

```sql
SELECT id, tenant_id, name, document_number, email, is_active, created_at, updated_at
FROM public.customers
ORDER BY created_at DESC NULLS LAST
LIMIT 20;
```

Ver conteo antes/despues si se registro el valor previo:

```sql
SELECT count(*) AS customers_count
FROM public.customers;
```

Ver que clientes existentes no quedaron obligados a datos fiscales:

```sql
SELECT count(*) AS customers_without_document_type
FROM public.customers
WHERE document_type_code IS NULL;
```

Este conteo puede ser mayor que cero y es valido en FE-1.

## Rollback

Advertencia: rollback elimina datos fiscales nuevos, logs DIAN/proveedor y catalogo `dian_document_types`. No toca ventas ni pedidos.

En ambiente permitido:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql
```

Verificar rollback:

```sql
SELECT to_regclass('public.dian_document_types') AS dian_document_types;
SELECT to_regclass('public.dian_acquirer_lookup_logs') AS dian_acquirer_lookup_logs;
```

Esperado: ambos `NULL`.

Verificar que columnas fiscales ya no existen:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN (
    'document_type_code',
    'document_number_normalized',
    'verification_digit',
    'legal_name',
    'fiscal_email',
    'is_final_consumer',
    'dian_last_lookup_at',
    'dian_last_lookup_status',
    'fiscal_status'
  );
```

Esperado: cero filas.

## Criterios de exito

1. La migracion termina sin error.
2. Las columnas fiscales nuevas existen en `customers`.
3. `fiscal_email` y `document_type_code` permiten null.
4. `fiscal_status` solo permite `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`.
5. `dian_last_lookup_status` permite null o `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`.
6. `dian_document_types` existe y no fue sembrada en esta fase.
7. `dian_acquirer_lookup_logs` existe y solo guarda resumen operativo.
8. Indice unico evita mas de un consumidor final activo por tenant.
9. `/api/customers` conserva columnas operativas existentes.
10. No se tocaron ventas, pedidos, POS, frontend ni backend funcional.

## Criterios de abortar

Abortar si ocurre cualquiera:

1. `public.customers` no existe.
2. Hay duplicados de consumidor final activo por tenant.
3. La migracion intenta ejecutarse contra PRD.
4. No existe backup restaurable en ambiente con datos importantes.
5. Falla la creacion de constraints o indices.
6. Se detecta bloqueo largo sobre `customers` durante horario POS critico.
7. Cualquier validacion posterior devuelve estructura incompleta.
8. Se observa impacto en ventas, pedidos o lectura basica de `customers`.
