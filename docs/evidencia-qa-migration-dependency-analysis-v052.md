# Evidencia QA - Migration Dependency Analysis V052 - MVP-00.4.7C

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.4.7C - Migration Dependency Analysis`

Resultado: `QA_MIGRATION_DEPENDENCY_CLASSIFIED`

## Objetivo

Analizar el bloqueo del bootstrap de `manus_tienda_qa` en:

`scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`

Error reportado:

```text
column "document_type_code" does not exist
```

## Alcance

Analisis local y de solo lectura sobre:

- `scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`
- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql`
- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`
- `scripts/database/migrations/*_rollback.sql`
- `scripts/database/migrate_prd.sh`
- referencias en `api/`

No se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco `manus_tienda`, no se toco `manus_tienda_qa` y no se desplego.

## Estado del bootstrap reportado

- Bootstrap de `manus_tienda_qa` continua avanzando.
- Migraciones aplicadas reportadas: `83+`.
- Nuevo bloqueo: `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`.

## Hallazgos en V052

`V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql` afecta estas tablas:

- `public.customers`
- `public.suppliers`

V052 agrega columnas FE-3.2 nuevas como:

- `dian_identification_type`
- `identification_number`
- `trade_name`
- `invoice_email`
- `country_code`
- `department_code`
- `municipality_code`
- `person_type`
- `tax_regime`
- `tax_responsibilities`
- `is_dian_validated`
- `dian_metadata`
- `fiscal_data_source`

Pero tambien usa columnas fiscales previas que no crea:

- `document_type_code`
- `document_number_normalized`
- `document_number`
- `fiscal_email`
- `fiscal_status`
- `fiscal_provider`

El primer punto fragil esta en el `UPDATE public.customers`, donde V052 escribe y lee `document_type_code`.

## Quien crea `document_type_code`

La columna existe por dependencia previa.

Para `public.customers`:

- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql`
- Agrega `document_type_code`, `document_number_normalized`, `verification_digit`, `legal_name`, `fiscal_email`, `is_final_consumer`, `dian_last_lookup_at`, `dian_last_lookup_status` y `fiscal_status`.

Para `public.suppliers`:

- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`
- Agrega `document_type_code`, `document_number_normalized`, `verification_digit`, `legal_name`, `fiscal_email`, `fiscal_status`, `fiscal_provider`, `fiscal_last_lookup_at` y `fiscal_last_lookup_status`.

## Quien elimina `document_type_code`

Se encontraron rollback scripts en el mismo directorio de migraciones:

- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql`
- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`

Estos scripts ejecutan:

- `ALTER TABLE IF EXISTS public.customers DROP COLUMN IF EXISTS document_type_code`
- `ALTER TABLE IF EXISTS public.suppliers DROP COLUMN IF EXISTS document_type_code`

Tambien eliminan otras columnas requeridas por V052, como `document_number_normalized`, `fiscal_email`, `fiscal_status` y `fiscal_provider`.

## Relacion con el runner

`scripts/database/migrate_prd.sh` arma la lista incremental con:

```text
find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' -print | sort
```

El runner ya tiene exclusiones para fixtures opcionales, pero no excluye `*_rollback.sql` del flujo forward.

Como los rollback files estan en `scripts/database/migrations/`, pueden entrar en el orden cronologico del bootstrap como si fueran migraciones forward.

Orden probable:

1. `20260603_electronic_invoicing_customers_phase_1.sql` crea `customers.document_type_code`.
2. `20260603_electronic_invoicing_customers_phase_1_rollback.sql` elimina `customers.document_type_code`.
3. `20260604_electronic_invoicing_suppliers_phase_1.sql` crea `suppliers.document_type_code`.
4. `20260604_electronic_invoicing_suppliers_phase_1_rollback.sql` elimina `suppliers.document_type_code`.
5. `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql` intenta usar `document_type_code`.
6. PostgreSQL falla con `column "document_type_code" does not exist`.

## Clasificacion

Clasificacion: bug de runner/clasificacion de migraciones.

No parece ser columna renombrada.

No parece ser que V052 invente una columna inexistente.

La dependencia previa existe y esta versionada:

- `20260603_electronic_invoicing_customers_phase_1.sql`
- `20260604_electronic_invoicing_suppliers_phase_1.sql`

El problema probable es que scripts de rollback destructivos se estan ejecutando dentro del flujo forward de bootstrap limpio.

## Fix seguro propuesto

No aplicado en esta fase. Solo propuesta.

1. Ajustar `scripts/database/migrate_prd.sh` para excluir `*_rollback.sql` del listado forward.

   Opcion simple:

   ```bash
   find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' ! -name '*_rollback.sql' -print
   ```

2. Agregar una funcion tipo `is_rollback_migration()` y saltar rollback scripts antes de aplicar SQL.

3. Mantener los rollback scripts versionados, pero solo para ejecucion manual y controlada desde runbook.

4. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md` para dejar explicito:

   - `*_rollback.sql` no participa en bootstrap forward.
   - rollback files solo se usan con aprobacion humana.

5. Para la DB parcial actual, no reintentar sin plan:

   - Si rollback migrations quedaron en `migrations_history`, un rerun puede saltar las migraciones forward ya registradas y no restaurar columnas.
   - Opcion preferida: recrear `manus_tienda_qa` limpia despues del fix, con aprobacion explicita.
   - Opcion alternativa: repair SQL puntual para reponer columnas FE antes de V052, tambien solo con aprobacion explicita.

## Riesgos

- `manus_tienda_qa` parcial puede tener columnas FE eliminadas y migrations_history inconsistente para este tramo.
- Otros rollback files en `scripts/database/migrations/` podrian eliminar objetos requeridos por migraciones posteriores.
- Si solo se parchea V052 para crear columnas faltantes, se oculta el problema real del runner.
- No ejecutar reparaciones sobre `manus_tienda_qa` sin backup vigente y orden aprobado.

## Validaciones

Ejecutadas desde `D:/Profe/manus-tienda`:

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS con warning de normalizacion LF/CRLF en `openspec/changes/mvp-web-hardening/tasks.md`
- `git status --short`: PASS revisado

Estado Git al cierre:

```text
 M openspec/changes/mvp-web-hardening/tasks.md
?? docs/evidencia-qa-migration-dependency-analysis-v052.md
```

## Restricciones cumplidas

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco AWS.
- No se toco `manus_tienda`.
- No se borro ni modifico `manus_tienda_qa`.
- No se desplego.
- No se reinicio servidor.
- No se tocaron PM2, Nginx ni PostgreSQL remotos.

## Siguiente paso recomendado

Solicitar aprobacion para fase de fix:

`MVP-00.4.7D - Excluir rollback scripts del forward migration runner`

Ese fix debe ajustar el runner antes de cualquier nuevo intento de bootstrap.
