## Why

Diagnóstico del 2026-11-13 (producto `AGUADIENTE003`, Sucursal Principal): el stock de Productos (kardex) es 95 y la suma de lotes es 110. La diferencia de 15 corresponde exactamente a cinco salidas de **Entregar pedido** sin vínculo a lote (5 + 3 + 2 + 2 + 3, `reference_table = 'orders'`, 2026-11-12).

`OrderService.deliverOrder` (`api/src/modules/inventory/services/order.service.ts` 1468-1650) valida solo el stock del kardex y registra la salida, pero no consume lotes: no descuenta `inventory_lot_balances` ni crea `stock_movement_lots`. La venta POS (`inventory_create_sale_v2`) sí consume por FEFO. Consecuencias:

- Kardex y lotes divergen y la conciliación marca discrepancias `LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK` (HIGH).
- Se puede entregar mercancía de lotes vencidos o bloqueados, porque solo se valida el kardex.
- `SaleService.cancelSale` rechaza ventas loteadas sin vínculo de lote, así que la venta generada desde esa entrega no se puede anular.
- `deliverOrder` no bloquea el producto antes de validar stock: dos entregas simultáneas pueden sobregirar.

## What Changes

- **Código:** Entregar pedido consume lotes con la misma regla de la venta POS: lotes `ACTIVE`, no vencidos, FEFO, con descuento de saldos y vínculo movimiento–lote, todo dentro de la transacción existente y con bloqueo del producto.
- **Validación:** para productos con lote, el stock entregable es el de lotes vendibles, no el del kardex; error claro cuando no alcanza.
- **Datos históricos:** script de corrección revisado y aprobado por el propietario, ejecutado aparte, para vincular las salidas existentes sin lote. No se ejecuta como parte de la implementación.
- Productos sin lote: sin cambios.

## Capabilities

### New Capabilities

- `order-delivery-lot-consumption`: consumo de lotes al entregar pedidos de productos con lote.

### Modified Capabilities

- Ninguna formal; aplica la regla FEFO ya definida en `openspec/specs/inventario` ("Reglas FEFO") al flujo de entrega.

## Impact

- `api/src/modules/inventory/services/order.service.ts` (`deliverOrder`) y su spec.
- Reutiliza `InventoryLotBalanceService.decrementOnHand`, `StockMovementLotService.createLink` y la regla de selección de `InventoryFefoService` (con lectura bloqueante dentro de la transacción).
- Sin cambios de contrato HTTP, permisos ni esquema. La corrección de datos es un script SQL aparte con aprobación explícita.
- Web: solo mensajes de error en `OrderDeliverForm.tsx` si hace falta.
