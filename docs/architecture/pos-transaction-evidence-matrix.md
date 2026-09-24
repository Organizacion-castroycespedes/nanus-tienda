# Matriz de evidencias del motor transaccional POS — B4.1

Las líneas apuntan al estado inspeccionado en la rama autorizada. Las referencias
SQL apuntan al archivo versionado; no certifican que todos los ambientes tengan
la misma versión instalada.

| Hallazgo | Evidencia primaria | Evidencia secundaria | Estado |
|---|---|---|---|
| Entrada Web de venta | `web/modules/pos/components/PosScreen.tsx:2460-2515` | `web/modules/pos/services/pos.service.ts:103-108` | Confirmado |
| Clave de idempotencia Web | `PosScreen.tsx:2468-2478` | `pos.service.ts:111-114` | Confirmado |
| Guards de creación | `api/src/modules/inventory/controllers/sale.controller.ts:76-84,165-180` | `sale.controller.ts:87-124` | Confirmado |
| Contexto tenant/sucursal/terminal/POS/caja | `sale.controller.ts:87-124` | `api/src/modules/inventory/services/sale.service.ts:480-504` | Confirmado |
| Reserva idempotente y hash | `api/src/modules/inventory/services/sale.service.ts:2541-2625` | `api/src/modules/inventory/repositories/sale.repository.ts:556-605` | Confirmado |
| Transacción principal | `sale.service.ts:2541-2745` | `sale.repository.ts:494-553` | Confirmado |
| Precio, impuestos y promociones | `api/src/modules/inventory/services/sale.service.ts:734-832` | `api/src/modules/pricing/pricing.service.ts:35-621` | Confirmado |
| Criterios de promoción | `api/src/modules/pricing/pricing.service.ts:543-621` | `api/src/modules/pricing/pricing.repository.ts:227-279` | Confirmado |
| Validación SQL de venta | `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql:74-203` | `V051...sql:250-459` | Confirmado |
| Salida de inventario | `V051...sql:622-655` | `api/src/modules/inventory/services/stock-movement.service.ts:131-227` | Confirmado |
| FEFO y bloqueo de lotes | `V051...sql:669-749` | `scripts/database/products/2026_04_25_inventory_stock_movements.sql` | Confirmado |
| Pagos dentro de transacción | `sale.service.ts:2640-2685` | `api/src/modules/finance/payments/payments.service.ts:406-588` | Confirmado |
| Igualdad de pagos para CASH | `sale.service.ts:809-832` | `V051...sql:775-820` | Confirmado |
| Outbox en venta automática | `sale.service.ts:1246-1393` | `docs/architecture/integration-outbox-as-is.md` | Confirmado condicional |
| Commit y rollback | `sale.service.ts:2680-2745` | `sale.service.ts:3086-3365` para cancelación | Confirmado |
| Reconciliación por clave | `sale.controller.ts:183-190` | `sale.repository.ts:completeSaleCreationIdempotency` | Confirmado |
| Cancelación y compensación | `sale.controller.ts:240-245` | `sale.service.ts:3086-3365` | Confirmado |
| Restricción de estados cancelables | `sale.service.ts:3086-3135` | `sale.service.ts:2045-2052` | Confirmado |
| Separación venta desde pedido | `sale.service.ts:2775-2893` | `sale.controller.ts` rutas de pedidos relacionadas | Confirmado como flujo distinto |
| Esquema de idempotencia | `scripts/database/migrations/V086__sale_creation_idempotency.sql:18-34` | `docs/database/persistence-as-is.md` | Confirmado en DDL; ambiente pendiente |
| Estado de reportes/DIAN/hardware | No hay evidencia de dependencia síncrona en `POST /sales` | B2.3/B2.4 y B3 | No verificado |

## Lectura de la evidencia

- La función SQL y `SaleService` demuestran efectos de venta e inventario, pero
  no demuestran que QA o producción tengan la misma migración aplicada.
- Las pruebas funcionales de concurrencia, timeout, reinicio, duplicados y
  proveedor fiscal no se ejecutaron en esta fase.
- Las referencias de frontend demuestran intención y contrato de llamada; la
  autoridad de precio, caja, stock y tenant está en el backend.
