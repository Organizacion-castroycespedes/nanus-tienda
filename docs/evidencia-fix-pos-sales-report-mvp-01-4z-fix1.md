# Evidencia FIX POS Sales Report MVP-01.4Z-FIX1

Resultado: `QA_POS_SALES_REPORT_FIXED`

## Alcance

- Endpoint objetivo: `GET /api/reports/pos-sales`.
- Servicio: `backend-reporteria`.
- Adapter: `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts`.
- Funcion SQL: `public.report_pos_sales`.

## Restricciones cumplidas

- No se toco AWS.
- No se hizo deploy.
- No se ejecuto bootstrap.
- No se ejecutaron migraciones contra QA.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- No se versionaron secretos.

## Reproduccion / stacktrace disponible

RCA disponible en:

- `docs/evidencia-root-cause-p0-p1-mvp-01-4y.md`

El body publico observado para `GET /api/reports/pos-sales` fue:

```json
{"statusCode":500,"message":"Internal server error"}
```

El stacktrace PM2 completo no quedo disponible en esa sesion por restricciones de acceso SSH:

```text
Host key verification failed.
Permission denied (publickey).
```

No se intento acceso AWS/PM2 en este fix por restriccion explicita.

## Diagnostico

El adapter actual llama:

```sql
SELECT report_pos_sales($1, $2, $3, $4, $5, $6, $7, $8) AS result
```

Firma esperada por `SalesReportAdapter.getSalesList`:

```text
report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)
```

Drift detectado en SQL versionado legacy:

```text
report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text)
```

Ese overload extendido con defaults puede coexistir con la firma de 8 parametros y dejar al runtime resolviendo una firma legacy o ambigua para una llamada de 8 parametros.

## Fix

Archivo creado:

- `scripts/database/migrations/V061__drop_legacy_report_pos_sales_overload.sql`

Manifest actualizado:

- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`

Cambio:

- Elimina idempotentemente el overload legacy de 10 parametros:

```text
report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text)
```

- Valida que existe la firma esperada de 8 parametros:

```text
report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)
```

- Valida que no queda mas de un overload `public.report_pos_sales`.

Adapter:

- No se cambio la llamada del adapter.
- Se confirmo que sigue enviando exactamente 8 parametros.

## Tests

Archivo actualizado:

- `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.spec.ts`

Cobertura agregada:

- `SalesReportAdapter.getSalesList` llama `report_pos_sales` con 8 parametros.
- `V061__drop_legacy_report_pos_sales_overload.sql` elimina el overload legacy y conserva la firma del adapter.

## Validaciones ejecutadas

```text
backend-reporteria focused tests
=> pass 2, fail 0
```

```text
cd backend-reporteria && npm.cmd run build
=> PASS
```

```text
openspec.cmd validate mvp-web-hardening --type change --strict
=> Change 'mvp-web-hardening' is valid
```

```text
git diff --check
=> PASS
```

## Decision

```text
QA_POS_SALES_REPORT_FIXED
```
