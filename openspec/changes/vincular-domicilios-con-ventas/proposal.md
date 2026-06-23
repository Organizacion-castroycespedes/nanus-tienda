## Why

Deliveries created from orders keep the order trace, but after the order becomes a sale the delivery can still show `Venta` as empty. Store staff need one operational path from Pedido to Venta to Domicilio without creating duplicate deliveries or touching fiscal/payment flows.

## What Changes

- Link an existing delivery to the generated sale when its source order becomes a sale.
- Keep `order_id` and `sale_id` as logistics/traceability references on the same delivery.
- Allow delivery listing/querying by `sale_id` when supported by the existing API.
- Show sale reference in delivery list/detail when available.
- Avoid duplicate deliveries for the same order/sale commercial flow.
- Preserve manual delivery creation when no order or sale association exists.
- Do not mutate payments, cash sessions, inventory, taxes, fiscal invoices, electronic invoicing, or sale totals.

## Capabilities

### New Capabilities
- `deliveries-sales-link`: Links deliveries with sales generated from related orders and prevents duplicate deliveries for the same commercial flow.

### Modified Capabilities

## Impact

- Backend delivery queries and idempotent delivery-sale association.
- Backend order-to-sale creation flow, only to assign `deliveries.sale_id` when an existing order delivery matches.
- Frontend delivery list/detail or sale/order navigation if existing components need small adjustments.
- Additive SQL only if `deliveries.sale_id` is missing.
- No caja/recaudo, payments, POS, inventory, fiscal invoice, or electronic invoicing behavior changes.
