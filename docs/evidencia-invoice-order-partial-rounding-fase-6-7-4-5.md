# Evidencia invoice order partial rounding - Fase 6.7.4.5

## Alcance

Implementacion SQL para que `inventory_invoice_order` absorba diferencias de redondeo en la ultima factura parcial de un `order_item` con snapshot suficiente.

Archivos creados/modificados:

- `scripts/database/migrations/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql`
- `scripts/database/rollbacks/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5_rollback.sql`
- `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-invoice-order-partial-rounding-fase-6-7-4-5.md`

## Regla implementada

La absorcion solo aplica cuando:

- `order_items` tiene snapshot suficiente.
- La rama de insercion usa `pricing_source = 'ORDER_ITEM_SNAPSHOT'`.
- No existen `sale_items` activos previos para el mismo `order_item_id` con `pricing_source` distinto de `ORDER_ITEM_SNAPSHOT`.
- Es la ultima factura del `order_item`.

La ultima factura se detecta con:

```sql
ROUND((billed_quantity + quantity_to_invoice)::numeric, 2)
  >= ROUND(ordered_quantity::numeric, 2)
```

## Calculo

Para facturas intermedias se mantiene el prorrateo existente:

```sql
ROUND(valor_snapshot * ratio, 2)
```

Para la ultima factura se calculan acumulados previos activos desde `sale_items` y se asigna el restante:

```sql
line_total = ROUND(order_items.line_total - previous_line_total_sum, 2)
tax_base = ROUND(order_items.tax_base - previous_tax_base_sum, 2)
tax_amount = ROUND(order_items.tax_amount - previous_tax_amount_sum, 2)
discount_total = ROUND(order_items.discount_total - previous_discount_total_sum, 2)
```

Para lineas sin impuesto:

```sql
tax_base = line_total restante
tax_amount = 0
```

No se crea `sale_item_taxes` cuando `order_items.tax_id IS NULL`.

## Constraint legacy

La migracion elimina:

```sql
ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS chk_sale_items_subtotal_matches;
```

Motivo: la ultima parcial puede necesitar `subtotal` distinto de `price * quantity` para absorber centavos, por ejemplo `price = 33.33`, `quantity = 1`, `subtotal = 33.34`.

No se recrea el constraint validado en rollback.

## Indice

La migracion crea:

```sql
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_order_item
  ON sale_items (tenant_id, order_item_id)
  WHERE order_item_id IS NOT NULL;
```

Uso: acelerar el SUM previo por `tenant_id` y `order_item_id`.

## Caso esperado

Pedido con:

```text
ordered_quantity: 3.00
line_total: 100.00
tax_base: 84.03
tax_amount: 15.97
```

Tres facturas parciales de cantidad `1.00` deben cerrar asi:

```text
line_total: 33.33 + 33.33 + 33.34 = 100.00
tax_amount: 5.32 + 5.32 + 5.33 = 15.97
```

## Compatibilidad legacy

La rama legacy permanece sin absorcion:

```text
pricing_source = LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT
```

Cuando hay `sale_items` previos activos con `pricing_source` legacy o NULL para el `order_item_id`, no se aplica absorcion y se conserva el prorrateo normal.

## Validaciones

Ejecutadas:

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`
- `cd api && npm.cmd run build`

Resultado:

```text
openspec validate: valid=true, failed=0
git diff --check: exit 0, sin errores de whitespace
npm.cmd run build: exit 0, tsc -p tsconfig.json OK
```

Nota: `git diff --check` reporto advertencias de normalizacion CRLF en archivos ya modificados por Git, sin fallar el comando.

No se ejecuto migracion contra PRD.
No se ejecuto remoto.
No se hizo commit.

## Riesgos

- No se ejecuto prueba API local de tres facturas en esta fase.
- Si existen ventas activas antiguas mezcladas para el mismo `order_item_id`, la funcion evita absorcion y mantiene prorrateo normal.
- El rollback restaura la funcion de Fase 6.7.4.2, pero no recrea `chk_sale_items_subtotal_matches` para no invalidar filas ya absorbidas.

## Restricciones cumplidas

- No se modifico API TypeScript.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico POS.
- No se modifico frontend.
- No se modifico facturacion electronica.
- No se modifico DIAN.
- No se modifico GetAcquirer.
- No se modifico suppliers.
- No se toco PRD real.
- No se ejecuto remoto.
- No se hizo commit.
