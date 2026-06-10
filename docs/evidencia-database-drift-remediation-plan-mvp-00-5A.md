# Evidencia - Database Drift Remediation Plan - MVP-00.5A

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.5A - Database Drift Remediation Plan`

Resultado: `QA_SCHEMA_DRIFT_REMEDIATION_PLANNED`

## Objetivo

Crear un plan de remediacion para eliminar drift entre:

- `manus_tienda_qa` bootstrap limpio
- `manus_tienda_prd/local` base de desarrollo comparada

Fuente base:

- `docs/evidencia-database-drift-analysis-mvp-00-5.md`
- `D:/compare-manus_tienda_qa-manus_tienda_prd-report.html`

Esta fase no ejecuta migraciones, no toca QA, no toca PRD, no modifica datos y no crea SQL ejecutable.

## Drift a Remediar

| Drift | Tipo | Estado |
| --- | --- | --- |
| `cash_movements.payment_id` | Missing column en QA | SQL existe, no entra al bootstrap |
| `cash_movements_payment_id_fkey` | Missing FK en QA | SQL existe, no entra al bootstrap |
| `idx_cash_movements_payment_id` | Missing index en QA | SQL existe, no entra al bootstrap |
| `uq_cash_movements_payment_once` | Missing index unico parcial en QA | SQL existe, no entra al bootstrap |
| `purchases.total_original` | Missing column en QA | SQL no versionado |
| `idx_auditoria_eventos_purchase_liquidated` | Missing index en QA | SQL no versionado |
| `report_purchase_ticket(...)` | Function source drift | Overwrite por orden de migraciones |

## 1. SQL Existente para `cash_movements.payment_id`

SQL existente:

- `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`

Contenido funcional:

```sql
ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS payment_id UUID NULL;

ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_payment_id_fkey
  FOREIGN KEY (payment_id)
  REFERENCES payments(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_payment_id
  ON cash_movements(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_movements_payment_once
  ON cash_movements(payment_id)
  WHERE payment_id IS NOT NULL
    AND movement_type = 'PAYMENT';
```

Por que no entra al bootstrap:

- `scripts/database/migrate_prd.sh` incluye finance base hasta:
  - `finance/migrations/20260430_1753_finance_base_infrastructure.sql`
  - `finance/migrations/20260430_1947_finance_payments_engine.sql`
  - `finance/migrations/20260502_1015_finance_cash_closing_controls.sql`
  - `finance/patches/20260430_1956_finance_payment_integration.sql`
  - `finance/patches/20260502_1135_finance_menu_access.sql`
  - `finance/patches/20260502_1840_finance_cash_movements_reference_text.sql`
- No incluye `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`.
- Ese SQL solo aparece en `scripts/database/finance/run_finance_migrations.sh`.
- El bootstrap QA usa `bootstrap-manus-tienda-qa.sh` -> `migrate_prd.sh`, no `finance/run_finance_migrations.sh`.

Plan recomendado:

1. Agregar `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` al arreglo `schema_files` de `scripts/database/migrate_prd.sh`, justo despues de `finance/patches/20260502_1840_finance_cash_movements_reference_text.sql`.
2. Documentar en manifest que forma parte del bootstrap limpio.
3. Validar que el SQL es idempotente:
   - columna usa `ADD COLUMN IF NOT EXISTS`;
   - constraint esta protegida por `IF NOT EXISTS`;
   - indices usan `CREATE INDEX IF NOT EXISTS`.
4. No duplicar el SQL en una nueva migracion salvo que el proyecto decida mover todos los ajustes finance a `scripts/database/migrations/V###`.

Alternativa si se exige solo `V###`:

- Crear una migracion nueva con el mismo contenido idempotente:
  - `scripts/database/migrations/V055__finance_cash_movement_payment_traceability_mvp_00_5a.sql`
- Riesgo: duplicar logica ya versionada bajo `finance/migrations`.

Preferencia tecnica:

- Incluir el SQL existente en el bootstrap principal, porque ya esta versionado y ya tiene runner especializado.

## 2. Migracion Propuesta para `purchases.total_original`

Objeto detectado:

- `public.purchases.total_original`

Estado:

- Existe en `manus_tienda_prd/local`.
- No existe en `manus_tienda_qa`.
- No aparece versionado en `scripts/database/` ni `api/`.

Clasificacion:

- SQL no versionado o cambio manual.

Migracion propuesta:

- Nombre tentativo: `scripts/database/migrations/V055__purchases_total_original_mvp_00_5a.sql`
- Si `V055` ya existe al momento de implementar, usar el siguiente `V###` disponible.

Contenido propuesto, idempotente:

```sql
BEGIN;

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS total_original numeric(14, 2);

UPDATE public.purchases
SET total_original = total
WHERE total_original IS NULL
  AND total IS NOT NULL;

COMMIT;
```

Decisiones pendientes antes de implementar:

- Confirmar tipo exacto en `manus_tienda_prd/local` desde metadata del compare o consulta segura.
- Confirmar si debe ser `NOT NULL`.
- Confirmar si debe tener default.
- Confirmar semantica funcional:
  - snapshot del total inicial de compra;
  - total antes de liquidacion parcial;
  - total antes de cancelacion;
  - otro significado.

Recomendacion:

- Empezar como nullable sin default y backfill `total`, para no romper compras existentes.
- Agregar `NOT NULL` solo si se valida que todas las filas deben tener valor y que el flujo de creacion de compras lo escribe.

## 3. Migracion Propuesta para `idx_auditoria_eventos_purchase_liquidated`

Objeto detectado:

- `public.idx_auditoria_eventos_purchase_liquidated`

Estado:

- Existe en `manus_tienda_prd/local`.
- No existe en `manus_tienda_qa`.
- No aparece versionado en `scripts/database/` ni `api/`.

Clasificacion:

- SQL no versionado o cambio manual.

Migracion propuesta:

- Nombre tentativo: `scripts/database/migrations/V056__audit_purchase_liquidated_index_mvp_00_5a.sql`
- Si `V056` ya existe al momento de implementar, usar el siguiente `V###` disponible.

Contenido propuesto, pendiente de confirmar columnas exactas:

```sql
BEGIN;

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_purchase_liquidated
  ON public.auditoria_eventos (tenant_id, entidad, accion, creado_en DESC)
  WHERE entidad = 'purchases'
    AND accion IN ('PURCHASE_LIQUIDATED', 'PURCHASE_PARTIALLY_LIQUIDATED');

COMMIT;
```

Decision pendiente:

- Confirmar columnas reales de `public.auditoria_eventos`.
- Confirmar nombre de columna de fecha:
  - `creado_en`
  - `created_at`
  - otra.
- Confirmar valores reales de accion/evento usados por compras liquidadas.

Regla:

- No crear indice hasta confirmar definicion real desde PRD/local o desde el SQL manual original.

## 4. Overwrite de `report_purchase_ticket` por `V047`

Drift detectado:

- Misma firma:
  - `report_purchase_ticket(uuid, text, uuid, uuid, uuid)`
- QA tiene fuente mas corta.
- PRD/local tiene fuente con liquidacion parcial:
  - `totalPedido`
  - `totalRecibido`
  - `totalLiquidado`
  - `diferenciaNoRecibida`
  - `liquidadoEn`
  - `liquidadoPor`
  - `liquidadoPorNombre`

SQL involucrados:

- `scripts/database/migrations/20260527_purchase_ticket_partial_liquidation.sql`
  - crea la version con liquidacion parcial.
- `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql`
  - tambien crea `report_purchase_ticket`.
  - Por orden alfabetico `LC_ALL=C sort`, `V047...` corre despues de `20260527...`.
  - Eso puede sobrescribir la version nueva con una fuente anterior.

Plan recomendado:

1. No editar `V047` si ya fue aplicado en ambientes.
2. Crear nueva migracion posterior al ultimo `V###`:
   - `scripts/database/migrations/V057__report_purchase_ticket_partial_liquidation_restore_mvp_00_5a.sql`
3. En esa migracion, re-crear `report_purchase_ticket(uuid, text, uuid, uuid, uuid)` usando la fuente de `20260527_purchase_ticket_partial_liquidation.sql`.
4. Mantener `CREATE OR REPLACE FUNCTION`.
5. No dropear funciones salvo que cambie firma.
6. Agregar nota al manifest: esta migracion debe correr despues de `V047`.

Riesgo que evita:

- Un bootstrap limpio queda con la funcion final esperada.
- PRD/local y QA vuelven a compartir la misma fuente.

## 5. Orden de Correccion Propuesto

No ejecutar aun. Este es el orden recomendado para una fase posterior.

1. Confirmar metadata exacta de PRD/local para:
   - `purchases.total_original` tipo/default/nullability;
   - `idx_auditoria_eventos_purchase_liquidated` definicion exacta.
2. Incorporar `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` al bootstrap principal.
3. Crear migracion idempotente para `purchases.total_original`.
4. Crear migracion idempotente para `idx_auditoria_eventos_purchase_liquidated`, solo con definicion confirmada.
5. Crear migracion idempotente para restaurar `report_purchase_ticket` final despues de `V047`.
6. Actualizar manifest y runbook de bootstrap.
7. Ejecutar validaciones locales:
   - shell syntax si se toca runner;
   - OpenSpec;
   - `git diff --check`.
8. Solo con aprobacion posterior:
   - recrear o reparar `manus_tienda_qa`;
   - aplicar bootstrap/migraciones;
   - regenerar compare report;
   - validar que drift funcional queda cerrado.

## Plan de Migraciones Tentativo

Numeracion sujeta al siguiente `V###` disponible al implementar.

| Orden | Archivo tentativo | Proposito |
| --- | --- | --- |
| 1 | Ajuste en `migrate_prd.sh` | Incluir `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` |
| 2 | `V055__purchases_total_original_mvp_00_5a.sql` | Versionar `purchases.total_original` |
| 3 | `V056__audit_purchase_liquidated_index_mvp_00_5a.sql` | Versionar indice de auditoria de liquidacion |
| 4 | `V057__report_purchase_ticket_partial_liquidation_restore_mvp_00_5a.sql` | Reponer fuente final de `report_purchase_ticket` despues de `V047` |

## Criterios de Exito para Remediacion Futura

Declarar drift remediado solo si nuevo compare report confirma:

- `cash_movements.payment_id` existe en QA y PRD/local.
- `cash_movements_payment_id_fkey` existe en QA y PRD/local.
- `idx_cash_movements_payment_id` existe en QA y PRD/local.
- `uq_cash_movements_payment_once` existe en QA y PRD/local.
- `purchases.total_original` existe en QA y PRD/local, si se confirma que es requerido.
- `idx_auditoria_eventos_purchase_liquidated` existe en QA y PRD/local, si se confirma que es requerido.
- `report_purchase_ticket(uuid, text, uuid, uuid, uuid)` tiene fuente equivalente.
- No hay rollback SQL ejecutado como forward migration.
- No hay SQL manual sin versionar para objetos funcionales MVP.

## Riesgos

- `purchases.total_original` puede tener semantica de negocio no confirmada.
- El indice `idx_auditoria_eventos_purchase_liquidated` puede depender de nombres de columnas o acciones no inferibles desde el reporte.
- Tocar report functions afecta `backend-reporteria`; debe validarse con smoke de compras y tickets.
- Agregar el SQL finance al bootstrap puede descubrir dependencias de payments/cash sessions en entornos parciales.
- Aplicar remediacion sobre DB parcial puede requerir repair o recreacion limpia.

## Resultado

`QA_SCHEMA_DRIFT_REMEDIATION_PLANNED`

## Implementacion Posterior MVP-00.5B

La fase `MVP-00.5B - Database Drift Remediation Implementation` implementa el plan con fixes versionados:

- `scripts/database/migrate_prd.sh` incluye `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` en el flujo forward.
- `scripts/database/migrations/V055__purchases_total_original_drift_fix.sql` versiona `purchases.total_original`.
- `scripts/database/migrations/V056__purchase_liquidation_audit_index_drift_fix.sql` versiona `idx_auditoria_eventos_purchase_liquidated`.
- `scripts/database/migrations/V057__restore_report_purchase_ticket_after_v047.sql` restaura `report_purchase_ticket` despues de `V047`.

Resultado de la implementacion: `QA_SCHEMA_DRIFT_REMEDIATION_IMPLEMENTED`.

## Validaciones

Ejecutadas desde `D:/Profe/manus-tienda`:

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS con warning LF/CRLF en `openspec/changes/mvp-web-hardening/tasks.md`
- `git status --short`: PASS revisado

Estado Git al cierre:

```text
 M openspec/changes/mvp-web-hardening/tasks.md
?? docs/evidencia-database-drift-analysis-mvp-00-5.md
?? docs/evidencia-database-drift-remediation-plan-mvp-00-5A.md
```

## Restricciones Cumplidas

- No se ejecutaron migraciones.
- No se toco QA.
- No se toco PRD.
- No se modificaron datos.
- No se hizo deploy.
- No se crearon migraciones ejecutables.
- Solo se genero plan documental.
