# Runbook migracion suppliers FE - fase FE-2.4B

## Objetivo

Aplicar migracion aditiva para preparar `suppliers` con campos fiscales opcionales compatibles con futura facturacion electronica y sincronizacion desde `backend-facturacion-electronica/`.

Archivos:

- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`
- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`

## Precondiciones

1. Confirmar que se ejecuta en ambiente local/QA, no PRD.
2. Confirmar acceso a PostgreSQL con permisos para `ALTER TABLE`, `CREATE INDEX` y `DROP INDEX`.
3. Confirmar existencia de `public.suppliers`.
4. Confirmar existencia de `public.suppliers.tenant_id`.
5. Confirmar que no hay deploy de compras o inventario en curso.
6. Confirmar ventana de rollback.

## Backup

Crear backup antes de migrar.

Ejemplo local/QA:

```powershell
pg_dump --host localhost --port 5432 --format custom --file backups/pre_fe_2_4b_suppliers.dump <database_name>
```

No exponer password ni secretos en la evidencia.

## Validacion PostgreSQL

```sql
SELECT version();
SELECT current_database();
SELECT inet_server_addr(), inet_server_port();
```

Confirmar que `inet_server_addr()` corresponde a local/QA esperado, no PRD.

## Validar estructura actual `suppliers`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'suppliers'
ORDER BY ordinal_position;
```

Validar columnas minimas:

```sql
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'id'
  ) AS has_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'tenant_id'
  ) AS has_tenant_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'document_number'
  ) AS has_document_number;
```

## Conteo antes

```sql
SELECT count(*) AS suppliers_before
FROM public.suppliers;
```

Opcional diagnostico de documentos:

```sql
SELECT tenant_id,
       regexp_replace(upper(trim(document_number)), '[^0-9A-Z]', '', 'g') AS normalized_document,
       count(*) AS total
FROM public.suppliers
WHERE document_number IS NOT NULL
  AND length(trim(document_number)) > 0
GROUP BY tenant_id, regexp_replace(upper(trim(document_number)), '[^0-9A-Z]', '', 'g')
HAVING count(*) > 1
ORDER BY total DESC;
```

## Ejecutar migracion local/QA

Ejemplo:

```powershell
psql --host localhost --port 5432 --dbname <database_name> --file scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql
```

No ejecutar contra PRD.

## Verificar columnas

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'suppliers'
  AND column_name IN (
    'document_type_code',
    'document_number_normalized',
    'verification_digit',
    'legal_name',
    'fiscal_email',
    'fiscal_status',
    'fiscal_provider',
    'fiscal_last_lookup_at',
    'fiscal_last_lookup_status'
  )
ORDER BY column_name;
```

Esperado:

- 9 columnas.
- `fiscal_status` `NOT NULL` con default `'PENDING'`.
- las demas columnas nullable.

## Verificar indices

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'suppliers'
  AND indexname IN (
    'idx_suppliers_tenant_document_number_normalized',
    'idx_suppliers_tenant_fiscal_status',
    'idx_suppliers_tenant_fiscal_last_lookup_at'
  )
ORDER BY indexname;
```

Esperado:

- `idx_suppliers_tenant_document_number_normalized`.
- `idx_suppliers_tenant_fiscal_status`.
- `idx_suppliers_tenant_fiscal_last_lookup_at`.

## Verificar constraints

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.suppliers'::regclass
  AND conname IN (
    'chk_suppliers_fiscal_status',
    'chk_suppliers_fiscal_last_lookup_status'
  )
ORDER BY conname;
```

Esperado:

- `chk_suppliers_fiscal_status`.
- `chk_suppliers_fiscal_last_lookup_status`.

Validacion negativa controlada dentro de transaccion:

```sql
BEGIN;

UPDATE public.suppliers
SET fiscal_status = 'INVALID_STATUS'
WHERE id = (
  SELECT id FROM public.suppliers LIMIT 1
);

ROLLBACK;
```

Esperado: falla por constraint si existe al menos un supplier.

## Validar backfill de documento normalizado

```sql
SELECT id, document_number, document_number_normalized
FROM public.suppliers
WHERE document_number IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;
```

Esperado:

- `document_number_normalized` sin espacios, puntos ni guiones.
- Letras en mayuscula si existian.

## Conteo despues

```sql
SELECT count(*) AS suppliers_after
FROM public.suppliers;
```

Esperado:

- `suppliers_after` igual a `suppliers_before`.
- No se eliminan proveedores.
- No se toca `purchases`.

## Validar compras no afectadas

```sql
SELECT count(*) AS purchases_count
FROM public.purchases;
```

Si `purchases` no existe en el ambiente, documentarlo. La migracion no depende de esa tabla ni la modifica.

## Rollback

Ejecutar solo si se requiere revertir en local/QA:

```powershell
psql --host localhost --port 5432 --dbname <database_name> --file scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql
```

Advertencia: rollback elimina datos fiscales nuevos de `suppliers`.

Validar rollback:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'suppliers'
  AND column_name IN (
    'document_type_code',
    'document_number_normalized',
    'verification_digit',
    'legal_name',
    'fiscal_email',
    'fiscal_status',
    'fiscal_provider',
    'fiscal_last_lookup_at',
    'fiscal_last_lookup_status'
  );
```

Esperado:

- 0 filas.

Confirmar que `suppliers` sigue existiendo:

```sql
SELECT count(*) AS suppliers_after_rollback
FROM public.suppliers;
```

## Criterios de exito

1. Backup creado.
2. Ambiente confirmado como local/QA, no PRD.
3. Migracion termina sin error.
4. `suppliers` conserva el mismo conteo.
5. Columnas fiscales existen.
6. Constraints existen.
7. Indices existen.
8. `document_number_normalized` se llena para suppliers con `document_number`.
9. `purchases` no se modifica.
10. Rollback fue probado en ambiente local/QA antes de promover.

## Criterios de abortar

Abortar si:

- El ambiente no es local/QA o hay duda de PRD.
- No existe `public.suppliers`.
- No existe `public.suppliers.tenant_id`.
- El backup falla.
- La migracion reduce el conteo de suppliers.
- Compras empiezan a fallar en validacion local/QA.
- Aparece bloqueo prolongado sobre `suppliers`.
- Alguna constraint queda parcialmente creada.

## Notas

- Esta migracion no crea tabla paralela de proveedores.
- Esta migracion no crea endpoints.
- Esta migracion no implementa sync con backend FE.
- Esta migracion no consulta DIAN ni proveedor tecnologico.
- Esta migracion no toca PRD por si misma.
