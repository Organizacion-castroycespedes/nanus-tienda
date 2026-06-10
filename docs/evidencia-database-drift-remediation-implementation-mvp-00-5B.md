# Evidencia - Database Drift Remediation Implementation - MVP-00.5B

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.5B - Database Drift Remediation Implementation`

Resultado: `QA_SCHEMA_DRIFT_REMEDIATION_IMPLEMENTED`

## Objetivo

Implementar fixes versionados para cerrar drift entre:

- `manus_tienda_qa` bootstrap limpio
- `manus_tienda_prd/local` base comparada

Fuentes usadas:

- `docs/evidencia-database-drift-analysis-mvp-00-5.md`
- `docs/evidencia-database-drift-remediation-plan-mvp-00-5A.md`

## Alcance

Cambios locales versionados solamente:

- Runner SQL forward.
- Migraciones idempotentes.
- Manifest y runbook de bootstrap.
- Evidencia QA y OpenSpec tasks.

No se ejecuto bootstrap. No se ejecutaron migraciones. No se toco QA. No se toco PRD. No se modificaron datos reales.

## Fix 1 - Finance Cash Payment Traceability

Archivo actualizado:

- `scripts/database/migrate_prd.sh`

Cambio:

- Se agrego `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` a `schema_files`.

Objetos cubiertos:

- `cash_movements.payment_id`
- `cash_movements_payment_id_fkey`
- `idx_cash_movements_payment_id`
- `uq_cash_movements_payment_once`

Motivo:

- El SQL ya existia y era idempotente, pero el bootstrap QA usaba `migrate_prd.sh` y no ejecutaba `finance/run_finance_migrations.sh`.

## Fix 2 - `purchases.total_original`

Archivo creado:

- `scripts/database/migrations/V055__purchases_total_original_drift_fix.sql`

Comportamiento:

- Agrega `public.purchases.total_original numeric(14, 2)` si no existe.
- Hace backfill seguro desde `purchases.total` cuando `total_original` esta nulo.
- Es idempotente por `ADD COLUMN IF NOT EXISTS`.

Decision:

- Se mantiene nullable y sin default para no romper compras existentes.

## Fix 3 - `idx_auditoria_eventos_purchase_liquidated`

Archivo creado:

- `scripts/database/migrations/V056__purchase_liquidation_audit_index_drift_fix.sql`

Comportamiento:

- Crea `idx_auditoria_eventos_purchase_liquidated` si no existe.
- Usa columnas reales de `public.auditoria_eventos`:
  - `tenant_id`
  - `entidad_id`
  - `created_at`
- Usa accion real del servicio de compras:
  - `PURCHASE_PARTIAL_CLOSED`

Decision:

- No depende de datos.
- No usa columnas no existentes como `creado_en`.

## Fix 4 - `report_purchase_ticket` despues de `V047`

Archivo creado:

- `scripts/database/migrations/V057__restore_report_purchase_ticket_after_v047.sql`

Comportamiento:

- Restaura `public.report_purchase_ticket(uuid, text, uuid, uuid, uuid)` con `CREATE OR REPLACE FUNCTION`.
- Usa como fuente la version de `scripts/database/migrations/20260527_purchase_ticket_partial_liquidation.sql`.
- Mantiene campos de liquidacion parcial esperados:
  - `totalPedido`
  - `totalRecibido`
  - `totalLiquidado`
  - `diferenciaNoRecibida`
  - `liquidadoEn`
  - `liquidadoPor`
  - `liquidadoPorNombre`

Motivo:

- `V047__sync_dev_functions_to_prd.sql` corre despues de migraciones fechadas por orden alfabetico y podia sobrescribir la funcion final.

## Manifest y Runbook

Archivos actualizados:

- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- `docs/runbook-exec-bootstrap-manus-tienda-qa.md`

Cambios:

- Manifest incluye finance traceability como flujo forward obligatorio.
- Manifest incluye `V055`, `V056` y `V057`.
- Runbook valida `V053` a `V057`.
- Runbook agrega smoke SQL para:
  - `purchases.total_original`
  - `idx_auditoria_eventos_purchase_liquidated`
  - firma `report_purchase_ticket`

## Validaciones

Comandos requeridos:

```bash
bash -n scripts/database/migrate_prd.sh
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

- `bash -n scripts/database/migrate_prd.sh`: PASS.
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS, `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS. Git emitio warnings de normalizacion LF -> CRLF en archivos modificados.
- `git status --short`: PASS, cambios locales esperados listados.

## Riesgos

- `purchases.total_original` se implementa como `numeric(14, 2)` nullable por compatibilidad; si PRD/local tuviera constraints adicionales, requeriria nueva evidencia antes de endurecer.
- El indice de auditoria usa accion real `PURCHASE_PARTIAL_CLOSED`; si aparece otra accion de liquidacion en el futuro, debera agregarse en nueva migracion.
- `V057` restaura la funcion esperada, pero debe validarse contra compare report despues del proximo bootstrap.

## Restricciones Cumplidas

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco QA.
- No se toco PRD.
- No se modificaron datos reales.
- No se desplego.
- No se reinicio servidor.
