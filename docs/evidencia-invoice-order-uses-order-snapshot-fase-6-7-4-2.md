# Evidencia inventory_invoice_order usa snapshot de order_items - Fase 6.7.4.2

## Decision

`inventory_invoice_order` queda preparado para facturar pedidos desde el snapshot de pricing guardado en `order_items` cuando el snapshot es suficiente.

Snapshot suficiente:

- `final_unit_price IS NOT NULL`
- `line_total IS NOT NULL`
- `pricing_calculated_at IS NOT NULL`

No se exige `pricing_snapshot` JSONB. Si existe se copia a `sale_items`; si no existe, se conserva `NULL`.

## Archivos

- `scripts/database/migrations/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`
- `scripts/database/rollbacks/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2_rollback.sql`
- `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-invoice-order-uses-order-snapshot-fase-6-7-4-2.md`

## Logica con snapshot

Cuando `order_items` tiene snapshot suficiente:

- `sale_items.price` toma `order_items.final_unit_price`.
- `sale_items.subtotal` toma `order_items.line_total` prorrateado.
- `sale_items.price_without_tax` toma `tax_base` prorrateado dividido entre la cantidad facturada.
- `sale_items.tax_total` toma `tax_amount` prorrateado.
- Se copian `base_unit_price`, `final_unit_price`, `discount_amount`, `discount_percent`, `applied_promotion_id`, `applied_promotion_name`, `pricing_snapshot` y `pricing_calculated_at`.
- Se prorratean `discount_total`, `tax_base`, `tax_amount` y `line_total`.
- `pricing_source = 'ORDER_ITEM_SNAPSHOT'`.

No se recalcula precio, promocion ni impuesto desde `products` o `taxes`.

## sale_item_taxes

Cuando hay snapshot y `order_items.tax_id IS NOT NULL` con impuesto prorrateado mayor que cero:

- `tax_id` viene de `order_items.tax_id`.
- `tax_rate` viene de `order_items.tax_rate`.
- `tax_amount` viene de `order_items.tax_amount` prorrateado.
- `taxes.name` se consulta solo como metadata textual.
- `taxes.rate` no se usa para calculo.
- `taxes.is_included` se usa solo como metadata; si falta, se usa `TRUE`.

Si `order_items.tax_id IS NULL`, no se crea `sale_item_taxes`.

## Fallback legacy

Si no hay snapshot suficiente:

- Se mantiene el comportamiento legacy.
- La funcion puede leer `products` y `taxes` actuales como antes.
- `pricing_source = 'LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT'`.
- `discount_amount = 0`, `discount_percent = 0`, `discount_total = 0`.
- `applied_promotion_id = NULL`.
- `applied_promotion_name = NULL`.
- No se inventa promocion.

## Facturacion parcial

La funcion sigue facturando la cantidad entregada pendiente:

`quantity_to_invoice = delivered_quantity - billed_quantity`

Para snapshot usa:

`ratio = quantity_to_invoice / ordered_quantity`

Y prorratea:

- `line_total`
- `tax_base`
- `tax_amount`
- `discount_total`

`base_unit_price` y `final_unit_price` se mantienen como valores unitarios.

Riesgo documentado: con cantidades parciales y centavos, la suma de varias facturas puede diferir por redondeo de 1 centavo. No se implemento absorcion de redondeo en ultima factura porque no hay patron aprobado todavia.

## No tocado

- POS
- Frontend
- Facturacion electronica
- DIAN
- GetAcquirer
- Suppliers fiscales
- PRD real
- Servidor remoto
- `SaleService`
- `OrderService`
- Commits

## Validaciones

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`: passed.
- `git diff --check`: passed, solo warnings de line endings LF/CRLF en archivos tocados.
- `cd api && npm.cmd run build`: passed.

No se ejecuto migracion contra PRD.

## Pendiente para 6.7.4.3

- Ejecutar validacion local/API con pedido con promocion e IVA, luego cambiar producto/impuesto/promocion y facturar confirmando que se usa snapshot.
- Validar facturacion parcial y redondeo.
- Validar pedido legacy sin snapshot.
- Validar linea sin impuesto.
- Consultar DB directamente porque la respuesta API actual no expone todos los campos snapshot de `sale_items`.
