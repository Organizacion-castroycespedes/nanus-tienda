# Evidencia fix final P0/P1 blockers MVP-01.4Z

Fecha: 2026-06-11 America/Bogota.

Resultado: `QA_FINAL_P0_P1_BLOCKERS_FIXED`

## Restricciones

- No AWS.
- No deploy.
- No PM2.
- No bootstrap.
- No migraciones ejecutadas.
- No escrituras directas en DB.
- Cambios versionados solamente.

## RCA base

Fuente:

- `docs/evidencia-root-cause-p0-p1-mvp-01-4y.md`

Causas tratadas:

1. `PATCH /api/purchases/:id/settle-partial` cambia `purchases.status` a `CERRADA_PARCIAL`, pero QA puede conservar constraint legacy sin ese estado.
2. `backend-reporteria` usa actor mock con `id=report-demo-user`, pero sus funciones SQL reciben `p_actor_user_id UUID`.
3. `GET /api/reports/pos-sales` requiere restaurar firma/function SQL esperada por el adapter.

## Fix P0: purchases.status

Archivo:

- `scripts/database/migrations/V059__purchase_status_constraint_partial_liquidation_drift_fix.sql`

Cambio:

- Elimina constraint legacy `purchases_status_check`.
- Elimina constraint versionado `chk_purchases_status`.
- Crea un unico `chk_purchases_status` con:
  - `DRAFT`
  - `PENDING`
  - `PARTIAL`
  - `RECEIVED`
  - `CERRADA_PARCIAL`
  - `CANCELLED`

Motivo:

- `CERRADA_PARCIAL` ya es estado valido del dominio en `PurchaseService`, entidades y tests.
- La migracion es idempotente y compatible con PostgreSQL 16.

## Fix P1: mock actor reporteria

Archivo:

- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts`

Cambio:

- Default mock user id ahora es UUID estable:

```text
40000000-0000-0000-0000-000000000001
```

- `x-report-user-id`, `x-report-tenant-id` y `x-report-branch-id` se aceptan solo si son UUID.
- Header invalido degrada a UUID default o `null` para branch.

Motivo:

- Evita `22P02 invalid input syntax for type uuid: "report-demo-user"` al llamar funciones SQL de reporteria.

## Fix P1 residual: report_pos_sales

Archivo:

- `scripts/database/migrations/V060__restore_report_pos_sales_signature.sql`

Cambio:

- Restaura `public.report_pos_sales` con la firma esperada por el adapter:

```text
report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)
```

- Valida firma con `pg_get_function_arguments`.

Adapter revisado:

- `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts`

Query generada:

```sql
SELECT report_pos_sales($1, $2, $3, $4, $5, $6, $7, $8) AS result
```

## Manifest

Archivo actualizado:

- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`

Cambio:

- Incluye `V059`.
- Incluye `V060`.
- Documenta idempotencia y proposito de ambas.

## Tests agregados

Archivos:

- `api/src/modules/inventory/services/purchase-status-migration.spec.ts`
- `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.spec.ts`

Cobertura:

- `V059` contiene drops de constraints legacy y `CERRADA_PARCIAL`.
- `V060` contiene firma esperada de `report_pos_sales` y validacion `pg_get_function_arguments`.
- `SalesReportAdapter.getSalesList` llama `report_pos_sales` con 8 parametros en orden esperado.
- `JwtAuthGuard` conserva UUID mock valido e ignora ids no UUID.

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd api && npm run build` | PASS, `tsc -p tsconfig.json` |
| `cd backend-reporteria && npm run build` | PASS, `tsc -p tsconfig.json` |
| `cd api && node node_modules/tsx/dist/cli.mjs --test src/modules/inventory/services/purchase-status-migration.spec.ts src/modules/inventory/services/purchase.service.spec.ts` | PASS, 38 tests |
| `cd backend-reporteria && node node_modules/tsx/dist/cli.mjs --test src/modules/auth/jwt-auth.guard.spec.ts src/modules/reports/sql-adapters/sales-report.adapter.spec.ts` | PASS, 6 tests |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS |
| `git diff --check` | PASS, solo warnings CRLF existentes |
| `git status --short` | PASS revisado |

`git status --short` observado:

```text
 M backend-reporteria/src/modules/auth/jwt-auth.guard.spec.ts
 M backend-reporteria/src/modules/auth/jwt-auth.guard.ts
 M docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md
 M openspec/changes/mvp-web-hardening/tasks.md
 M scripts/database/bootstrap-manus-tienda-qa.manifest.md
?? api/src/modules/inventory/services/purchase-status-migration.spec.ts
?? backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.spec.ts
?? docs/evidencia-fix-final-p0-p1-blockers-mvp-01-4z.md
?? docs/evidencia-root-cause-p0-p1-mvp-01-4y.md
?? scripts/database/migrations/V059__purchase_status_constraint_partial_liquidation_drift_fix.sql
?? scripts/database/migrations/V060__restore_report_pos_sales_signature.sql
```

## Riesgo residual

- Los cambios SQL estan versionados, pero no aplicados en QA por restriccion.
- Requieren despliegue/migracion posterior controlada y rerun QA.

## Decision

```text
QA_FINAL_P0_P1_BLOCKERS_FIXED
```
