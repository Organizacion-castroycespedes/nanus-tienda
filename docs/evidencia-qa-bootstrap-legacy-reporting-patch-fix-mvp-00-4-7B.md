# Evidencia QA - Bootstrap Legacy Reporting Patch Fix MVP-00.4.7B

## Objetivo

Corregir el patch legacy `20260505_sync_local_to_aws_reporting_and_sales.sql` para que no rompa el bootstrap limpio de `manus_tienda_qa`.

## Estado actual

Segun evidencia recibida:

- `manus_tienda_qa` fue creada.
- `manus_qa_user` fue creado.
- 50 migraciones quedaron aplicadas en `public.migrations_history`.
- El bootstrap fallo en:

```text
migrations/20260505_sync_local_to_aws_reporting_and_sales.sql
```

Error:

```text
function public.report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz) does not exist
```

## Causa raiz

El archivo contiene un `DROP FUNCTION` sin `IF EXISTS`:

```sql
DROP FUNCTION public.report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz);
```

En una base limpia la funcion puede no existir aun. PostgreSQL falla al intentar eliminar una funcion inexistente cuando no se usa `IF EXISTS`.

## Analisis

Archivo revisado:

- `scripts/database/migrations/20260505_sync_local_to_aws_reporting_and_sales.sql`

Busqueda:

```powershell
Select-String -Path scripts\database\migrations\20260505_sync_local_to_aws_reporting_and_sales.sql -Pattern "DROP FUNCTION"
```

Resultado:

- Solo se encontro un `DROP FUNCTION`.
- Ese `DROP FUNCTION` era el problematico.

Hallazgos relacionados:

- La funcion tambien aparece en `scripts/database/migrations/20260507_reporting_phase5_business_reports.sql`.
- La funcion tambien aparece en `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql`.
- `backend-reporteria/src/modules/reports/sql-adapters/customers-report.adapter.ts` depende de la funcion para reporteria.

## Fix aplicado

Se cambio:

```sql
DROP FUNCTION public.report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz);
```

Por:

```sql
-- Legacy sync patch must be safe on clean QA databases where this function may not exist yet.
DROP FUNCTION IF EXISTS public.report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz);
```

## Documentacion actualizada

- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`: documenta que `20260505_sync_local_to_aws_reporting_and_sales.sql` es patch legacy de sincronizacion y debe ser idempotente.
- `docs/runbook-exec-bootstrap-manus-tienda-qa.md`: agrega validacion de que patches legacy obligatorios usan `DROP FUNCTION IF EXISTS`.
- `openspec/changes/mvp-web-hardening/tasks.md`: agrega fase MVP-00.4.7B.

## Riesgos

- `manus_tienda_qa` sigue en estado parcial hasta que se defina reintento controlado.
- No se verifico contra AWS en esta fase por restriccion explicita.
- Otros patches legacy pueden contener operaciones no idempotentes en archivos distintos. Esta fase solo corrigio el archivo reportado.
- Reintento de bootstrap debe hacerse en fase separada y autorizada.

## Resultado

`QA_BOOTSTRAP_LEGACY_PATCH_FIXED`

## Validaciones

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS. Resultado: `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS con warnings CRLF informativos.
- `git status --short`: PASS informativo. Cambios en migracion legacy, docs, OpenSpec y manifest; sin env real versionado.

## Restricciones cumplidas

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco AWS.
- No se toco `manus_tienda`.
- No se borro `manus_tienda_qa`.
- No se hizo deploy.
- No se reinicio servidor.
