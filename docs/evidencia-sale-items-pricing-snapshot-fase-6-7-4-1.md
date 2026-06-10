# Evidencia Sale Items Pricing Snapshot Fase 6.7.4.1

## Alcance

Se preparo la base de datos para que `sale_items` pueda conservar snapshot de precio, descuento, promocion e impuesto al facturar pedidos desde `order_items` en una fase posterior.

No se modifico `inventory_invoice_order`, `SaleService`, `OrderService`, POS ni frontend.

## Archivos

- `scripts/database/migrations/V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql`
- `scripts/database/rollbacks/V048__sale_items_pricing_snapshot_phase_6_7_4_1_rollback.sql`
- `api/src/modules/inventory/entities/sale-item.entity.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-sale-items-pricing-snapshot-fase-6-7-4-1.md`

## Columnas nuevas

- `base_unit_price NUMERIC(14, 2) NULL`
- `final_unit_price NUMERIC(14, 2) NULL`
- `discount_amount NUMERIC(14, 2) DEFAULT 0`
- `discount_percent NUMERIC(8, 4) DEFAULT 0`
- `discount_total NUMERIC(14, 2) DEFAULT 0`
- `applied_promotion_id UUID NULL`
- `applied_promotion_name TEXT NULL`
- `tax_base NUMERIC(14, 2) DEFAULT 0`
- `tax_amount NUMERIC(14, 2) DEFAULT 0`
- `line_total NUMERIC(14, 2) NULL`
- `pricing_snapshot JSONB NULL`
- `pricing_calculated_at TIMESTAMPTZ NULL`
- `pricing_source VARCHAR(40) NULL`

## Compatibilidad

La migracion agrega columnas nullable. Para no recalcular ni inventar snapshots historicos, las columnas numericas con default se crean primero como `NULL` y luego reciben `DEFAULT 0`. Asi las ventas existentes conservan `NULL` en snapshot.

Se mantienen sin cambios:

- `sale_items.price`
- `sale_items.price_without_tax`
- `sale_items.tax_total`
- `sale_items.subtotal`

En fases futuras, `sale_items.price` seguira representando `finalUnitPrice` por compatibilidad.

En fases futuras, `sale_items.subtotal` seguira representando `lineTotal` por compatibilidad.

`sale_item_taxes` seguira conservando `tax_id`, `tax_name`, `tax_rate` y `tax_amount` como snapshot fiscal por item.

## Rollback

Se creo rollback idempotente en `scripts/database/rollbacks/`.

El rollback queda fuera de `scripts/database/migrations/` para evitar que `migrate_prd.sh` lo aplique como migracion incremental.

## Indices

No se crearon indices nuevos en esta fase.

Motivo: no hay consultas ni reportes actuales filtrando `sale_items.applied_promotion_id` o `sale_items.pricing_snapshot`. Reportes futuros pueden requerir un indice por `(tenant_id, applied_promotion_id)` o un indice especifico sobre `pricing_snapshot`, pero debe nacer de una consulta concreta.

## No tocado

- `inventory_invoice_order`
- `SaleService`
- `OrderService`
- POS
- Frontend
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

## Pendiente para 6.7.4.2

- Leer snapshot desde `order_items` al facturar pedido.
- Persistir snapshot en `sale_items` sin recalcular precio, promocion ni impuesto desde producto actual.
- Crear `sale_item_taxes` desde el impuesto del snapshot cuando exista.
- Definir fallback seguro para pedidos historicos sin snapshot.
- Cubrir pruebas de facturacion de pedidos con snapshot y con fallback historico.
