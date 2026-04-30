# Flujo de datos de inventario

## Entrada por compra

1. Se crea compra.
2. La compra queda `DRAFT` o `PENDING`.
3. Al recibir items, `PurchaseService` llama `StockMovementService`.
4. Se insertan movimientos `IN`.
5. El stock visible se recalcula desde `stock_movements`.

## Salida por venta

1. Se crea venta desde POS u orden facturada.
2. `SaleService` valida cliente, productos, stock y pagos.
3. Inserta `sales`, `sale_items`, `sale_item_taxes`, `sale_payment_methods`.
4. Registra movimientos `OUT`.

## Salida por entrega de pedido

1. El pedido debe estar confirmado.
2. Se entregan cantidades por item.
3. Se registran movimientos `OUT`.
4. El estado del pedido pasa a `PARTIAL` o `COMPLETED`.

## Ajuste manual

Solo `SUPER_ADMIN` y `SUPER_USER`:

- `POST /api/stock-adjustments`
- genera `stock_movements` con referencia `ADJUSTMENT`
