## Context

Evidencia en `develop` @ `2c07b94f` (2026-11-14):

- `OrderController.deliver` mapea `body.items` y llama a `deliverOrder` sin leer encabezados.
- `deliverOrder`: `BEGIN` → `SELECT … FROM orders WHERE id AND tenant_id LIMIT 1` (sin `FOR UPDATE`) → lectura de `order_items` → validaciones de pendiente → `lockDeliveryStockScopes` (advisory lock por producto) → `OUT` + `consumeDeliveryLots` → `UPDATE order_items SET delivered_quantity = delivered_quantity + x` → estado → `COMMIT`.
- El advisory lock serializa por producto, pero la cantidad pendiente ya se leyó antes de tomarlo.

Patrón existente que se reutiliza: `PurchaseService.claimPurchaseReceiptIdempotency`, `completePurchaseReceiptIdempotency` y `buildPurchaseReceiptRequestHash` (sha256 de `stableSerialize`), y `normalizePurchaseIdempotencyKey`.

## Goals / Non-Goals

**Goals:** un reintento devuelve el mismo resultado sin entregar dos veces; dos entregas concurrentes del mismo pedido no sobrepasan el pendiente.

**Non-Goals:** anular entregas; cambiar FEFO; reservas; cambiar la facturación del pedido (`invoiceOrder`).

## Decisions

- **D1. Encabezado obligatorio.** `Idempotency-Key` (máximo 128 caracteres). Sin él, 400 "Idempotency-Key is required", igual que en compras.
- **D2. Tabla `order_delivery_idempotency`.** PK `(tenant_id, order_id, idempotency_key)`, `request_hash CHAR(64)`, `status PENDING|COMPLETED|FAILED`, `result JSONB`, `operation_reference`, timestamps y los mismos CHECK que `purchase_receipt_idempotency`.
- **D3. Hash.** `{orderId, tenantId, items (tal como los mapea el controlador), context, actor}`. Cuando exista el change de series, `serialIds` forma parte de `items` y queda cubierto sin cambios adicionales.
- **D4. Orden dentro de la transacción.** `SELECT … FROM orders … FOR UPDATE`, luego reclamar la idempotencia (si es replay: `COMMIT` y devolver el resultado), luego el flujo actual sin cambios, luego completar la idempotencia y `COMMIT`.
- **D5. Helpers.** Se extraen o duplican en `order.service.ts`, sin tocar `purchase.service.ts`. Unificar los helpers queda como deuda técnica.

## Risks / Trade-offs

- El `FOR UPDATE` del pedido serializa las entregas del mismo pedido, lo cual es deseable; no afecta a pedidos distintos.
- Las filas `PENDING` huérfanas no deberían quedar, porque se insertan y completan en la misma transacción.

## Migration Plan

`V###__order_delivery_idempotency.sql` + `scripts/database/rollbacks/V###__order_delivery_idempotency_rollback.sql` (DROP TABLE), siguiendo la gobernanza de migraciones. Sin datos históricos.

## Open Questions

- Ninguna bloqueante.
