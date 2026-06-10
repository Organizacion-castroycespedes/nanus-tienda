# Evidencia - Database Drift Analysis - MVP-00.5

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.5 - Database Drift Analysis`

Resultado: `QA_SCHEMA_DRIFT_CLASSIFIED`

## Objetivo

Analizar diferencias entre:

- `manus_tienda_qa` como bootstrap limpio
- `manus_tienda_prd/local` como base de desarrollo comparada

Fuente usada:

- `D:/compare-manus_tienda_qa-manus_tienda_prd-report.html`

No se ejecutaron migraciones, no se toco QA, no se toco PRD, no se modificaron datos y no se ejecuto SQL contra base de datos.

## Resumen Ejecutivo

El reporte contiene drift real de aplicacion y drift de entorno.

Drift funcional principal:

- QA no tiene `cash_movements.payment_id`, su foreign key e indices.
- QA no tiene `purchases.total_original`.
- QA no tiene `idx_auditoria_eventos_purchase_liquidated`.
- Hay diferencias de firmas/overloads en funciones de reportería.
- Hay diferencia de fuente en `report_purchase_ticket(uuid, text, uuid, uuid, uuid)`.

Causa probable:

- `cash_movements.payment_id` esta versionado en `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`, pero el bootstrap forward actual no lo incluye.
- `purchases.total_original` y `idx_auditoria_eventos_purchase_liquidated` no aparecen versionados en `scripts/database/` ni `api/`; se clasifican como cambios manuales o SQL no versionados en `manus_tienda_prd/local`.
- `report_purchase_ticket` parece sufrir overwrite por orden: `20260527_purchase_ticket_partial_liquidation.sql` crea version mas nueva, pero `V047__sync_dev_functions_to_prd.sql` corre despues en orden alfabetico y puede dejar una fuente mas antigua en QA limpio.

## 1. Missing Columns

### Missing in QA

| Tabla | Columna | Existe en PRD/local | Existe en QA | Clasificacion |
| --- | --- | --- | --- | --- |
| `cash_movements` | `payment_id` | Si | No | SQL versionado no incluido por bootstrap |
| `purchases` | `total_original` | Si | No | SQL no versionado o cambio manual |

Detalle:

- `cash_movements.payment_id` esta en `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`.
- Ese SQL esta referenciado por `scripts/database/finance/run_finance_migrations.sh`.
- No aparece incluido en el orden principal de `scripts/database/migrate_prd.sh` revisado en fases anteriores.
- `purchases.total_original` no aparece en busqueda local bajo repo; debe tratarse como drift manual/no versionado hasta que se aporte SQL fuente.

### Missing in PRD/local

No se detectaron columnas de aplicacion faltantes en PRD/local frente a QA.

Nota: el reporte muestra una diferencia de parametros internos de `pgp_armor_headers`, clasificada como ruido de extension/sistema y no como columna de aplicacion.

## 2. Missing Indexes

### Missing in QA

| Tabla | Indice | Existe en PRD/local | Existe en QA | Clasificacion |
| --- | --- | --- | --- | --- |
| `auditoria_eventos` | `idx_auditoria_eventos_purchase_liquidated` | Si | No | SQL no versionado o cambio manual |
| `cash_movements` | `idx_cash_movements_payment_id` | Si | No | SQL versionado no incluido por bootstrap |
| `cash_movements` | `uq_cash_movements_payment_once` | Si | No | SQL versionado no incluido por bootstrap |

Detalle:

- Los indices de `cash_movements` estan en `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`.
- `idx_auditoria_eventos_purchase_liquidated` no aparece versionado en el repo; queda clasificado como manual/no versionado.

### Missing in PRD/local

No se detectaron indices de aplicacion faltantes en PRD/local frente a QA.

## 3. Missing Constraints

No se detectaron check constraints ni unique constraints nominales faltantes como constraints.

Nota: `uq_cash_movements_payment_once` es un indice unico parcial y se clasifica en missing indexes.

## 4. Missing Foreign Keys

### Missing in QA

| Tabla | Foreign key | Existe en PRD/local | Existe en QA | Clasificacion |
| --- | --- | --- | --- | --- |
| `cash_movements` | `cash_movements_payment_id_fkey` | Si | No | SQL versionado no incluido por bootstrap |

Detalle:

- FK versionada en `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`.
- Depende de `cash_movements.payment_id`.

### Missing in PRD/local

No se detectaron foreign keys faltantes en PRD/local frente a QA.

## 5. Missing Triggers

No se detectaron triggers faltantes entre QA y PRD/local en el reporte.

## 6. Missing Functions

### Presentes en QA y ausentes en PRD/local

| Funcion | Clasificacion |
| --- | --- |
| `report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text)` | Versionada; PRD/local parece no tener overload nuevo con filtros de cliente |
| `report_pos_sales(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text)` | Versionada; PRD/local no tiene overload extendido |
| `report_purchases(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz)` | Versionada; overload legacy presente en QA por orden de migraciones |

### Presentes en PRD/local y ausentes en QA

| Funcion | Clasificacion |
| --- | --- |
| `report_customer_orders_status(uuid, text, uuid, uuid, uuid, uuid, timestamptz, timestamptz)` | Legacy. QA limpio queda con overload nuevo de 10 parametros con defaults; PRD/local conserva overload antiguo |

## 7. Function Source Differences

Se detecto una diferencia de fuente para una funcion con la misma firma:

| Funcion | Diferencia |
| --- | --- |
| `report_purchase_ticket(uuid, text, uuid, uuid, uuid)` | QA tiene fuente mas corta. PRD/local contiene logica de liquidacion parcial (`totalPedido`, `totalRecibido`, `totalLiquidado`, `diferenciaNoRecibida`, `liquidadoEn`, `liquidadoPor`). |

Causa probable:

- `scripts/database/migrations/20260527_purchase_ticket_partial_liquidation.sql` crea la version con liquidacion parcial.
- `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql` tambien crea `report_purchase_ticket` y, por orden alfabetico, corre despues de migraciones fechadas `20260527`.
- En un bootstrap limpio, `V047` puede sobrescribir la version mas nueva con una fuente anterior.

Riesgo:

- Ticket de compra en QA puede no reflejar campos de liquidacion parcial aunque PRD/local si los tenga.
- Esto requiere correccion en una fase posterior, idealmente con nueva migracion que consolide la version final esperada de `report_purchase_ticket`.

## 8. SQL No Versionados

Objetos detectados en PRD/local sin SQL versionado encontrado en repo:

- `purchases.total_original`
- `idx_auditoria_eventos_purchase_liquidated`

Clasificacion:

- SQL no versionado o cambio manual directo en DB.

Accion recomendada:

- No copiar manualmente.
- Definir si son necesarios para MVP.
- Si son necesarios, crear migracion idempotente nueva y documentada.
- Si no son necesarios, documentar descarte y no propagarlos a QA.

## 9. Cambios Manuales o Drift de Entorno

El reporte muestra diferencias no funcionales de entorno:

### Settings

- QA tiene `extension_destdir`.
- PRD/local no lo muestra.

Clasificacion:

- Drift de configuracion/sistema. No tratar como migracion de aplicacion.

### Roles

Presentes solo en QA:

- `flexi_user`
- `manus_qa_user`
- `manus_user`

Presente solo en PRD/local:

- `postgresql`

Clasificacion:

- Drift de roles PostgreSQL por ambiente.
- No versionar como schema de aplicacion.
- No bloquear MVP mientras ownership/permisos operativos esten definidos en runbook.

## 10. Causa Raiz por Grupo

| Grupo | Causa raiz probable | Estado |
| --- | --- | --- |
| `cash_movements.payment_id` + FK + indices | SQL versionado existe, pero no lo aplica bootstrap principal | Clasificado |
| `purchases.total_original` | No encontrado en repo | Manual/no versionado |
| `idx_auditoria_eventos_purchase_liquidated` | No encontrado en repo | Manual/no versionado |
| `report_purchase_ticket` source | Orden/overwrite por `V047` despues de `20260527` | Version ordering bug |
| Reporting overloads | PRD/local y QA no comparten set completo de overloads | Version drift |
| Roles/settings | Diferencia de entorno | No app schema |

## Riesgos

- Reintentar bootstrap sin incluir `20260503_2030_finance_cash_payment_traceability.sql` mantiene QA sin trazabilidad `cash_movements.payment_id`.
- Si se apunta backend-reporteria a QA limpio, `report_purchase_ticket` puede devolver payload sin campos de liquidacion parcial esperados.
- PRD/local puede estar dependiendo de objetos manuales no versionados.
- Agregar todo el drift sin criterio puede arrastrar cambios manuales no deseados.

## Recomendacion

No ejecutar migraciones todavia.

Preparar fase posterior:

`MVP-00.5A - Database Drift Remediation Plan`

Orden sugerido:

1. Decidir si `20260503_2030_finance_cash_payment_traceability.sql` debe entrar al bootstrap principal.
2. Definir si `purchases.total_original` es requerido o debe descartarse.
3. Definir si `idx_auditoria_eventos_purchase_liquidated` es requerido o debe descartarse.
4. Consolidar `report_purchase_ticket` en una nueva migracion idempotente posterior a `V047`.
5. Revisar overloads esperados por `backend-reporteria`.
6. Volver a generar compare report despues de cualquier remediacion aprobada.

## Validaciones

Ejecutadas desde `D:/Profe/manus-tienda`:

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS con warning LF/CRLF en `openspec/changes/mvp-web-hardening/tasks.md`
- `git status --short`: PASS revisado

Estado Git al cierre:

```text
 M openspec/changes/mvp-web-hardening/tasks.md
?? docs/evidencia-database-drift-analysis-mvp-00-5.md
```

## Restricciones Cumplidas

- No se ejecutaron migraciones.
- No se toco QA.
- No se toco PRD.
- No se modificaron datos.
- No se ejecutaron comandos remotos.
- No se hizo deploy.
- Solo se analizo el compare report y fuentes versionadas locales.
