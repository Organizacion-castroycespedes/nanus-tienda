# Evidencia Orders Pricing Snapshot Fase 6.7.1

## Alcance

Se preparo la base de datos para que `order_items` pueda conservar snapshot de pricing al crear o actualizar pedidos en una fase posterior.

No se integro `PricingService` en `OrderService` todavia.

## Archivos

- `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql`
- `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1_rollback.sql`
- `api/src/modules/inventory/entities/order-item.entity.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`

## Columnas nuevas

- `base_unit_price NUMERIC(14, 2) NULL`
- `final_unit_price NUMERIC(14, 2) NULL`
- `discount_amount NUMERIC(14, 2) DEFAULT 0`
- `discount_percent NUMERIC(8, 4) DEFAULT 0`
- `discount_total NUMERIC(14, 2) DEFAULT 0`
- `applied_promotion_id UUID NULL`
- `applied_promotion_name TEXT NULL`
- `tax_id UUID NULL`
- `tax_rate NUMERIC(8, 4) DEFAULT 0`
- `tax_base NUMERIC(14, 2) DEFAULT 0`
- `tax_amount NUMERIC(14, 2) DEFAULT 0`
- `line_total NUMERIC(14, 2) NULL`
- `pricing_snapshot JSONB NULL`
- `pricing_calculated_at TIMESTAMPTZ NULL`

## Compatibilidad

La migracion agrega columnas nullable. Para no recalcular ni inventar snapshots historicos, las columnas numericas con default se crean primero como `NULL` y luego reciben `DEFAULT 0`. Asi los pedidos existentes conservan `NULL` en snapshot.

`price` se mantiene sin cambios. En Fase 6.7.2, `price` seguira representando `finalUnitPrice` por compatibilidad.

`subtotal` se mantiene sin cambios. En Fase 6.7.2, `subtotal` seguira representando `lineTotal` por compatibilidad.

## Indices

No se crearon indices nuevos en esta fase.

Motivo: no hay consultas ni reportes actuales filtrando por `applied_promotion_id` o `tax_id` en Orders. Crear indices ahora seria prematuro. Se pueden agregar en una fase de reporteria o auditoria cuando exista consulta concreta.

## Rollback

Se creo rollback idempotente para eliminar constraints y columnas agregadas.

## No tocado

- `OrderService`
- `SaleService`
- Frontend
- POS
- Facturacion electronica
- DIAN
- GetAcquirer
- Suppliers fiscales
- PRD real
- Comandos remotos
- Commits

## Validaciones

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`: passed.
- `git diff --check`: passed.
- `cd api && npm.cmd run build`: passed.

## Pendiente para 6.7.2

- Inyectar `PricingService` en `OrderService`.
- Calcular cada linea con `channel: "ORDER"`.
- Persistir snapshot real en las columnas nuevas.
- Mantener `price = finalUnitPrice` y `subtotal = lineTotal`.
- Evitar recalculo de promociones al facturar.
