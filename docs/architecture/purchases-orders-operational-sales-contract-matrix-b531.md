# Matriz de contratos — Compras, pedidos y ventas operativas B5.3.1

| Acción Web | Cliente | Método y ruta | Backend | Guardas / permiso | Efecto |
|---|---|---|---|---|---|
| Crear compra | `web/modules/inventory/services/purchase.service.ts` | `POST /purchases` | `PurchaseController.create` → `PurchaseService` | JWT, roles administrativos, caja abierta, `INVENTORY_PURCHASES.WRITE` | `purchases`, `purchase_items`, estado inicial |
| Recibir compra | mismo cliente | `POST /purchases/:id/receive` | `PurchaseController.receive` → `PurchaseService.receivePurchase` | JWT, roles administrativos, caja abierta, permiso de escritura | cantidades recibidas, lotes, stock movements |
| Cancelar compra | mismo cliente | `PATCH /purchases/:id/cancel` | `cancelPurchase` | acción `cancel` y caja abierta | estado, motivo y auditoría |
| Liquidar compra parcial | mismo cliente | `PATCH /purchases/:id/settle-partial` | `settlePartialPurchase` | acción `settle_partial` y caja abierta | cierre parcial, pagos y auditoría |
| Crear pedido | `web/modules/inventory/services/order.service.ts` | `POST /orders` | `OrderController.create` → `OrderService` | JWT, roles, caja abierta, `ORDERS.WRITE` | `orders`, `order_items`, estado `DRAFT` |
| Confirmar pedido | mismo cliente | `POST /orders/:id/confirm` | `confirmOrder` | JWT, roles, caja abierta, `ORDERS.WRITE` | `DRAFT` → `CONFIRMED` |
| Entregar pedido | mismo cliente | `POST /orders/:id/deliver` | `deliverOrder` | JWT, roles, caja abierta, `ORDERS.WRITE` | cantidades, estado y stock |
| Facturar pedido | mismo cliente | `POST /orders/:id/invoice` | `invoiceOrder` | caja abierta, `RequirePosSession`, `ORDERS.WRITE` | venta/pagos derivados del pedido |
| Cancelar pedido | mismo cliente | `POST /orders/:id/cancel` | `cancelOrder` | JWT, roles, caja abierta, `ORDERS.WRITE` | estado `CANCELLED` cuando aplica |
| Listar ventas operativas | `web/modules/operational-sales/services/operational-sales.service.ts` | `GET /operations/sales` | `OperationalSalesService.list` | JWT, roles, `POS`/`OPERATIONS_SALES.READ` | lectura filtrada |
| Ver venta operativa | mismo cliente | `GET /operations/sales/:saleId` | `OperationalSalesService.detail` | igual | lectura de `sales` y estado fiscal |
| Refrescar fiscal | mismo cliente | `POST /operations/sales/:saleId/electronic-billing/refresh` | `refreshElectronicBillingStatus` | permiso POS lectura | actualización fiscal |
| Reintentar fiscal | mismo cliente | `POST /operations/sales/:saleId/electronic-billing/retry` | `retryElectronicBilling` | permiso POS escritura | reintento fiscal |
| Recuperar intención fiscal | mismo cliente | `POST /operations/sales/:saleId/electronic-billing/recover-provider-create-intent` | `recoverProviderCreateIntent` | permiso POS escritura | recuperación fiscal |

Referencias:

- `api/src/modules/inventory/controllers/purchase.controller.ts`
- `api/src/modules/inventory/controllers/order.controller.ts`
- `api/src/modules/operational-sales/operational-sales.controller.ts`
- `web/modules/inventory/services/purchase.service.ts`
- `web/modules/inventory/services/order.service.ts`
- `web/modules/operational-sales/services/operational-sales.service.ts`

Los prefijos `/api` dependen del bootstrap global de la API. La tabla muestra
la ruta relativa del controlador.
