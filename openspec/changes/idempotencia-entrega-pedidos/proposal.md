## Why

`POST /orders/:id/deliver` (`OrderController.deliver` → `OrderService.deliverOrder`, `api/src/modules/inventory/services/order.service.ts`) no tiene `Idempotency-Key`. Además, lee el pedido sin `FOR UPDATE` y lee `order_items` antes de `lockDeliveryStockScopes`.

Un doble clic, un reintento de red o dos usuarios entregando el mismo pedido pueden validar ambos contra la misma cantidad pendiente. El resultado son dos salidas `OUT`: el kardex y los lotes bajan el doble de lo que salió físicamente.

Compras (`purchase_receipt_idempotency`, V109) y POS (`sale_creation_idempotency`) ya están protegidos. Este change cierra la brecha en pedidos. Es un requisito previo de `incorporar-trazabilidad-series-productos`, que asigna series en la entrega.

## What Changes

- `POST /orders/:id/deliver` exige el encabezado `Idempotency-Key`, igual que `POST /purchases/:id/receive`.
- Tabla nueva `order_delivery_idempotency` (mismo diseño que `purchase_receipt_idempotency`): mismo key + mismo hash devuelve el resultado guardado; mismo key + hash distinto devuelve 409.
- `deliverOrder` bloquea la fila del pedido (`SELECT … FOR UPDATE`) antes de leer las cantidades pendientes. Así, dos entregas del mismo pedido se ejecutan en serie.
- `OrderDeliverForm.tsx` genera una clave por apertura del formulario y la reutiliza en los reintentos.
- Sin cambios en la regla FEFO (`consumeDeliveryLots`), en `inventory_create_sale_v2`, en POS ni en la facturación del pedido.

## Capabilities

### New Capabilities

- `order-delivery-idempotency`: entrega de pedidos idempotente y serializada por pedido.

### Modified Capabilities

- Ninguna.

## Impact

- API: `order.controller.ts` (`deliver`), `order.service.ts` (`deliverOrder`, helpers de idempotencia), `order.service.spec.ts`, `order.controller.spec.ts`.
- BD: migración `V###__order_delivery_idempotency.sql` + rollback (número según la última versión al implementar; hoy V115).
- Web: `web/modules/inventory/services/order.service.ts` (`deliverOrder` con encabezado), `OrderDeliverForm.tsx`.
- Contrato HTTP: el encabezado pasa a ser obligatorio. La web se despliega junto con el API (Electron carga la web en línea), por lo que no hay clientes antiguos que mantener.
