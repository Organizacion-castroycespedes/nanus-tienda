# Evidencia Fase 6.8.3 - inventory_create_sale_v2 persiste snapshot POS

## Alcance implementado

- Se creo `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql`.
- Se creo `scripts/database/rollbacks/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3_rollback.sql`.
- Se actualizo `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql` para fresh DB.
- Se actualizo `openspec/changes/fortalecer-productos-inventario/tasks.md`.

## Rama POS_PRICING_SERVICE

Cuando un item llega con `pricing_source = 'POS_PRICING_SERVICE'`, `inventory_create_sale_v2`:

- Usa `final_unit_price` como `sale_items.price`.
- Usa `line_total` como `sale_items.subtotal`.
- Usa `price_without_tax`, `tax_amount`/`tax_total`, `tax_base`, descuento, promocion y snapshot desde el payload.
- Persiste `pricing_snapshot`, `pricing_calculated_at` y `pricing_source = 'POS_PRICING_SERVICE'`.
- Suma `sales.total` con `line_total`.
- Inserta `sale_item_taxes` con `tax_id`, `tax_rate` y `tax_amount` del payload.
- Consulta `taxes.name` solo como metadata textual y usa fallback `POS_PRICING_SERVICE_TAX` si el nombre esta vacio.
- Rechaza `tax_amount > 0` cuando `tax_id` viene nulo.

## Rama legacy

Cuando el item no trae `pricing_source = 'POS_PRICING_SERVICE'`, el flujo conserva comportamiento anterior:

- Usa `item.price`.
- Calcula impuesto desde `products.tax_id` y `taxes.rate`.
- Inserta `sale_items` con columnas legacy.
- Inserta `sale_item_taxes` desde impuesto actual del producto.
- Suma `sales.total` como `price * quantity`.

## Stock, FEFO, pagos y caja

- No se modifico la logica de `stock_movements`.
- No se modifico la logica de `inventory_lot_balances`.
- No se modifico la logica de `stock_movement_lots`.
- No se movio ni cambio el consumo FEFO.
- Pagos CASH siguen validados por SQL contra `v_total`; para snapshot POS ese total viene de `line_total`.
- No se autoajustan pagos.

## Restricciones cumplidas

- No se toco API TypeScript.
- No se toco `SaleService`.
- No se toco `SaleRepository`.
- No se toco frontend POS.
- No se toco Orders ni `inventory_invoice_order`.
- No se toco facturacion electronica, DIAN, GetAcquirer ni suppliers.
- No se ejecuto remoto.
- No se toco PRD real.
- No se hizo commit.

## Validaciones ejecutadas

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`: passed.
- `git diff --check`: passed, solo warnings LF/CRLF del worktree.
- `cd api && npm.cmd run build`: passed.

## Riesgos pendientes para 6.8.4 QA local

- Validar en DB local/copia QA que V048 y V050 esten aplicadas antes de V051.
- Validar venta POS con promocion y tax snapshot contra producto/tax mutados despues.
- Validar venta POS sin tax_id y `tax_amount = 0`.
- Validar rechazo controlado cuando `tax_amount > 0` y `tax_id` es nulo.
- Validar CASH mismatch directo en SQL con `line_total`.
- Validar producto loteado con FEFO y snapshot POS en la misma venta.
