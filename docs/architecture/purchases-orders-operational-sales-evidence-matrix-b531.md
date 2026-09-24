# Matriz de evidencias — Compras, pedidos y ventas operativas B5.3.1

| Hecho | Evidencia | Estado |
|---|---|---|
| Rutas de compras | `api/src/modules/inventory/controllers/purchase.controller.ts` | Confirmado |
| Rutas de pedidos | `api/src/modules/inventory/controllers/order.controller.ts` | Confirmado |
| Rutas de ventas operativas | `api/src/modules/operational-sales/operational-sales.controller.ts` | Confirmado |
| Servicio de compras | `api/src/modules/inventory/services/purchase.service.ts` | Confirmado |
| Servicio de pedidos | `api/src/modules/inventory/services/order.service.ts` | Confirmado |
| Consulta operativa | `api/src/modules/operational-sales/operational-sales.service.ts` y repositorios | Confirmado |
| Cliente Web de compras | `web/modules/inventory/services/purchase.service.ts` | Confirmado |
| Cliente Web de pedidos | `web/modules/inventory/services/order.service.ts` | Confirmado |
| Cliente Web operativo | `web/modules/operational-sales/services/operational-sales.service.ts` | Confirmado |
| Recepción parcial | `PurchaseService.receivePurchase`, `purchase-receive-lines.ts` | Confirmado |
| Liquidación parcial | `PurchaseService.settlePartialPurchase`, `SettlePartialPurchaseForm.tsx` | Confirmado |
| Precio de pedido | `OrderService`, `PricingService`, migración de snapshot | Confirmado en código; QA histórico |
| Bloqueo de compra | `purchase.service.ts` con `FOR UPDATE` | Confirmado |
| Bloqueo de pedido | `order.service.ts` con transacción y lectura de fila | Confirmado; cobertura de todas las rutas pendiente |
| Rollback compra | `purchase.service.ts` y `purchase.service.spec.ts` | Confirmado por prueba versionada |
| Rollback pedido | `order.service.ts` y `order.service.spec.ts` | Confirmado por prueba versionada |
| Compra → stock | recepción y `stock_movements` | Confirmado |
| Compra → pagos | funciones SQL con `reference_type = 'PURCHASE'` | Confirmado |
| Pedido → pagos | invoice y `payments` | Confirmado |
| Pedido → delivery | `DeliveriesService.createFromOrder` | Confirmado |
| Venta operativa → fiscal | refresh/retry/recovery | Confirmado |
| Idempotency-Key en compras | no encontrado en controlador/cliente revisados | No verificado como capacidad |
| Idempotency-Key en pedidos | no encontrado en controlador/cliente revisados | No verificado como capacidad |
| Outbox automático para compras | no demostrado en productores revisados | Pendiente |
| Outbox automático para pedidos | no demostrado en productores revisados | Pendiente |
| QA actual de ambiente | no ejecutado en B5.3.1 | No ejecutado |

Evidencia histórica adicional, no ejecución actual:

- `docs/evidencia-api-local-orders-pricing-fase-6-7-3.md`
- `docs/evidencia-api-local-invoice-order-snapshot-fase-6-7-4-3.md`
- `docs/evidencia-recepcion-compras-lotes-fase-3-6.md`
- `scripts/database/tests/20260528_phase5_operational_integral_test.ts`
- `docs/release/inventario-modulos-v0-0-1.md`
