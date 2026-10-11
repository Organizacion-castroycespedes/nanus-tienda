## Why

POS can classify products as `WEIGHT` or `BOTH`, and the scale authorization foundation can persist a REAL, KG-verified capture. `POST /sales` still accepts client quantity and has no capture claim, so the POS cannot complete an authorized sale by weight safely.

This change connects one-time scale captures to sale lines while preserving the existing server pricing, tax, promotion, inventory, payment and idempotency authorities.

## What Changes

- Add a discriminated sale-line contract: `UNIT` keeps client quantity; `WEIGHT` sends only `saleMode: "WEIGHT"` and `weightCapture: { captureId, nonce }`; `BOTH` requires an explicit `UNIT` or `WEIGHT` mode.
- Derive weighted quantity from the persisted capture in `SaleService`. Keep raw evidence at up to six decimal places and use one deterministic `commercialQuantityKg` at three decimal places for pricing, taxes, promotions, sale item, inventory and ticket.
- Extend the sale transaction to validate and lock capture context, create sale and inventory effects, associate capture with its exact sale item, consume once, process payments/finalization/idempotency, and commit atomically.
- Add forward-only persistence for the capture-to-sale-item relationship and three-decimal quantity support across the weighted sale, applicable stock/lots paths, and linked order fulfillment quantities. V104 is the governed migration identity; do not modify or recreate V103.
- Preserve current POS inventory behavior for products in this flow. Non-inventariable products and any product-level inventory tracking policy are out of scope and deferred to a separate HU.
- Connect Web → Electron → local Agent for the physical read and Agent/API for durable REAL evidence. Keep secrets out of renderer and keep cloud API away from serial ports.
- Enable weighted POS flow only after authorization and capture succeed. Keep UNIT behavior unchanged, require explicit mode for BOTH, and expose confirmed weight, price per kg and subtotal for ticket generation.

## Capabilities

### New Capabilities
- `weighted-pos-sale`: Capture-backed POS sales by weight, three-decimal commercial quantity, atomic sale/inventory/payment consumption, and ticket data.

### Modified Capabilities

## Impact

- API: `POST /sales`, `SaleService`, sale-line validation, pricing integration, repositories and transaction tests.
- Database: `sale_items`, `stock_movements`, lot balances/movement links, linked `order_items` quantities and the active `inventory_create_sale_v2` implementation; V103 capture storage is reused. Product stock thresholds, fiscal columns and monetary precision remain unchanged.
- Web POS: cart line mode and capture reference, `UNIT`/`WEIGHT`/`BOTH` actions, sale response and ticket input.
- Electron and Peripheral Agent: local read handoff and authenticated evidence delivery to the API.
- OpenSpec: this new capability; existing scale authorization requirements remain owned by the integrated authorization change.
- Governance: implementation must evaluate the next migration identity against current repository and authorized DEV_TO_QA evidence before creating SQL. This proposal does not allocate a version or authorize migration execution.
