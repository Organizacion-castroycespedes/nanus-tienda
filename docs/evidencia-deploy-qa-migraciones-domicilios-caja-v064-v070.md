# Evidencia QA --- Deploy migraciones V063-V070 (domicilios/caja)

**Fecha/hora:** 2026-06-23 17:44 America/Bogota

## Objetivo
Aplicar las migraciones faltantes de Domicilios/Caja en QA, sin tocar PRD, y dejar trazabilidad en `public.migrations_history`.

## Rama y commit
- Rama: `release/evolutivo/0.0.1`
- Commit: `5049b8d` (`5049b8dfe10ec03cb221e0f148ca8324e8fa3c53`)

## Motivo del bloqueo inicial
- `V065` mostraba `ERROR:  Required table public.deliveries does not exist`.
- En `migrations_history` ya estaban `V063..V070`, pero la base no tenia tablas `deliveries`, `delivery_drivers`, `delivery_status_history`.
- `scripts/config/db.env` apunta a PRD y no se uso.

## Conexion y guardia dura
- Repo validado: `/home/ubuntu/manustienda/nanus-tienda`
- Base objetivo validada: `manus_tienda_qa`
- Guardia dura ejecutada:
  - `SELECT current_database(), current_schema(), current_user;`
  - Resultado: `manus_tienda_qa | public | manus_user`

## Backup obligatorio
- Nuevo backup creado: `/home/ubuntu/backups/manus_tienda_qa_before_v063_v070_20260623_174309.dump`
- `ls -lh`: `1.2M`
- `stat`: `1169097` bytes

## Archivos/versiones verificados
- `scripts/config/db.qa.env` (sin tocar `scripts/config/db.env` de PRD)
- Migraciones objetivo:
  - `V063__deliveries_base.sql`
  - `V064__deliveries_menu_visible.sql`
  - `V065__deliveries_operational_state_timestamps.sql`
  - `V066__delivery_drivers.sql`
  - `V067__deliveries_current_cash_session.sql`
  - `V068__cash_session_audits_breakdown.sql`
  - `V069__orders_purchases_current_cash_scope.sql`
  - `V070__deliveries_menu_permissions_seed.sql`

## Aprobacion de V063
- Existe en repo y es idempotente:
  - Usa `CREATE TABLE IF NOT EXISTS`
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto`
  - `DO ... ADD CONSTRAINT IF NOT EXISTS`
  - `CREATE INDEX IF NOT EXISTS`
  - No tiene `DROP`
  - No borra datos

## Aplicacion ejecutada
- Se mantuvo orden: `V063 -> V065 -> V066 -> V067 -> V068 -> V069 -> V070`.
- `V064` ya estaba registrada en `migrations_history`, se salteo esa parte.
- `V063` se aplico finalmetne con usuario `postgres` contra QA para completar DDL.
- `V065, V066, V067, V068, V069, V070` aplicados en orden tras habilitar permisos de `postgres`.

## Historial de migraciones (post)
```sql
V064__deliveries_menu_visible.sql
V063__deliveries_base.sql
V065__deliveries_operational_state_timestamps.sql
V066__delivery_drivers.sql
V067__deliveries_current_cash_session.sql
V068__cash_session_audits_breakdown.sql
V069__orders_purchases_current_cash_scope.sql
V070__deliveries_menu_permissions_seed.sql
```

## Validaciones SQL post
- `table_schema, table_name` en (`deliveries`, `delivery_drivers`, `delivery_status_history`):
  - aparecen las 3 tablas.
- `information_schema.columns` objetivo:
  - `deliveries.driver_id`, `dispatched_at`, `delivered_at`, `cancelled_at`, `failed_at`, `cash_session_id`, `cash_register_id`, `terminal_id`, `cash_impact_amount`, `cash_impact_recorded_at`
  - `cash_counts.count_type`, `cash_counts.breakdown_json`
  - `orders.cash_session_id`, `purchases.cash_session_id`
  - todos presentes.
- MenU DELIVERIES:
  - `tenant_id=00000000-0000-0000-0000-000000000001`
  - `key=DELIVERIES`
  - `label=Domicilios`
  - `route=/{tenant}/deliveries`
  - `visible=true`
- Permisos:
  - `USER`: `DELIVERIES_VIEW`, `CREATE`, `UPDATE`, `DISPATCH`, `MARK_DELIVERED`, `MARK_NOT_DELIVERED`
  - `ADMIN`: includes view/create/update/assign/dispatch/mark_delivered/mark_not_delivered/cancel/reports
  - `SUPER_USER`: same as ADMIN
  - `SUPER_ADMIN`: same as ADMIN

## Reinicio de servicios
- `pm2 restart api-linux --update-env`
- `pm2 restart backend-reporteria-linux --update-env`
- `web` no aparece en `pm2 list` para reiniciar.

## Logs revisados
- `pm2 logs api-linux --lines 120`
- `pm2 logs backend-reporteria-linux --lines 120`
- No se encontraron errores bloqueantes para: `deliveries`, `delivery_drivers`, `cash_session_id`, `count_type`, `breakdown_json`.

## Resultado final
- Estado: **PASS**
