# Evidencia QA - Migraciones Domicilios + Caja 0.0.1

Fecha: 2026-06-23

Rama: `feat/develop/cierre-funcionalidad-de-domicilios`

## Migraciones revisadas

| Migracion | Proposito | Estado local documentado |
| --- | --- | --- |
| `V064__deliveries_menu_visible.sql` | Hace visible el menu `DELIVERIES` cuando existe el item. | Archivo presente. No se reconsulto DB en esta tarea. |
| `V065__deliveries_operational_state_timestamps.sql` | Agrega `dispatched_at` y `failed_at` a `deliveries`. | Archivo presente. Referenciado en QA de estados. |
| `V066__delivery_drivers.sql` | Crea `delivery_drivers` y agrega `deliveries.driver_id`. | Archivo presente. Referenciado en QA de repartidores. |
| `V067__deliveries_current_cash_session.sql` | Agrega contexto de caja a `deliveries`. | Archivo presente. No se reconsulto DB en esta tarea. |
| `V068__cash_session_audits_breakdown.sql` | Agrega `count_type` y `breakdown_json` a `cash_counts`. | Documentado como aplicado localmente en QA el 2026-06-22. |
| `V069__orders_purchases_current_cash_scope.sql` | Agrega `cash_session_id` a `orders` y `purchases`. | Documentado como aplicado localmente en QA. |

## Revision SQL

- `DROP`: no encontrado.
- `TRUNCATE`: no encontrado.
- `DELETE` destructivo: no encontrado.
- `ON DELETE` aparece solo como regla de FK (`CASCADE` o `SET NULL`), no como sentencia destructiva.
- `V064` contiene `UPDATE` acotado a `menu_items.key = 'DELIVERIES'`, validado como cambio de visibilidad de menu.
- Migraciones aditivas con `IF NOT EXISTS` donde aplica.

## AWS / PRD

- No se ejecuto SQL contra AWS.
- No se ejecuto SQL contra PRD.
- `scripts/database/migrate_prd.sh` aplica migraciones incrementales desde `scripts/database/migrations/*.sql` y registra en `public.migrations_history`.
- Antes de PRD se debe ejecutar backup/snapshot aprobado.
- El nombre `migrate_prd.sh` es historico; usar solo con env aprobado para QA/PRD.

## Confirmaciones

- SQL destructivo: NO.
- Migraciones nuevas creadas en esta tarea: NO.
- Migraciones PRD ejecutadas: NO.
- Deploy AWS ejecutado: NO.
