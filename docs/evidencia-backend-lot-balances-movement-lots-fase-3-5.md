# Evidencia backend lot balances y movement lots - Fase 3.5

## Fecha y ambiente

- Fecha/hora: 2026-05-28 01:30:52 -05:00
- Ambiente: local/dev
- Alcance: `api/` modulo `inventory`
- Cambio OpenSpec: `fortalecer-productos-inventario`

## Archivos creados o modificados

### Creados

| Archivo | Proposito |
| --- | --- |
| `api/src/modules/inventory/entities/inventory-lot-balance.entity.ts` | Modelo de saldo por lote/sucursal/ubicacion. |
| `api/src/modules/inventory/entities/stock-movement-lot.entity.ts` | Modelo de relacion entre movimiento y lote. |
| `api/src/modules/inventory/repositories/inventory-lot-balance.repository.ts` | Consultas parametrizadas para saldos y metodos internos de cantidades. |
| `api/src/modules/inventory/repositories/stock-movement-lot.repository.ts` | Consultas parametrizadas para relaciones movimiento-lote. |
| `api/src/modules/inventory/services/inventory-lot-balance.service.ts` | Reglas de validacion y metodos internos para saldos. |
| `api/src/modules/inventory/services/stock-movement-lot.service.ts` | Reglas de validacion y metodo interno para vinculos movimiento-lote. |
| `api/src/modules/inventory/controllers/inventory-lot-balance.controller.ts` | Endpoints publicos solo lectura de saldos. |
| `api/src/modules/inventory/controllers/stock-movement-lot.controller.ts` | Endpoints publicos solo lectura de movement lots. |
| `api/src/modules/inventory/services/inventory-lot-balance.service.spec.ts` | Tests unitarios de saldos por lote. |
| `api/src/modules/inventory/services/stock-movement-lot.service.spec.ts` | Tests unitarios de relaciones movimiento-lote. |

### Modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/inventory.module.ts` | Registro de nuevos controllers, services y repositories. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Registro de Fase 3.5 completada. |

## Endpoints solo lectura agregados

| Metodo | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/inventory/lot-balances` | Lista saldos por lote con filtros. |
| `GET` | `/api/inventory/lot-balances/:balanceId` | Consulta saldo por id. |
| `GET` | `/api/inventory/stock-movement-lots/by-movement/:stockMovementId` | Consulta lotes vinculados a un movimiento. |
| `GET` | `/api/inventory/stock-movement-lots/by-lot/:lotId` | Consulta movimientos vinculados a un lote. |

No se agregaron endpoints publicos de escritura para `inventory_lot_balances` ni `stock_movement_lots`.

## Metodos internos preparados

| Service | Metodos |
| --- | --- |
| `InventoryLotBalanceService` | `createBalance`, `updateQuantities`, `incrementOnHand`, `decrementOnHand`, `reserve`, `releaseReservation`. |
| `StockMovementLotService` | `createLink`. |

Estos metodos aceptan `PoolClient` opcional para ser usados dentro de transacciones futuras de compras, ventas, pedidos, ajustes y FEFO. En esta fase no modifican el comportamiento actual de stock.

## Reglas y validaciones implementadas

- `tenant_id` se valida en toda operacion.
- `branch_id`, `product_id` y `lot_id` deben coincidir con el lote.
- `location_id` es opcional, pero si llega debe pertenecer al mismo tenant y sucursal.
- `quantityOnHand >= 0`.
- `quantityReserved >= 0`.
- `quantityReserved <= quantityOnHand`.
- `decrementOnHand` rechaza descuento por encima de disponible.
- `reserve` rechaza reserva por encima de disponible.
- `releaseReservation` rechaza liberacion por encima de reservado.
- `stockMovementId` debe pertenecer al tenant.
- `productId` debe coincidir con `stock_movements.product_id`.
- `lotId` en `StockMovementLotService` es opcional para compatibilidad legacy, pero si llega debe pertenecer al tenant y producto.
- `quantity` en `StockMovementLotService.createLink` debe ser mayor que cero.
- Controllers delegan reglas a services y solo exponen lectura.

## Confirmacion de no impacto funcional

- No se modifico `SaleService`.
- No se modifico `PurchaseService`.
- No se modifico `OrderService`.
- No se modifico `StockMovementService`.
- No se modifico `sale.repository.ts`.
- No se modifico `stock_movements`.
- No se modificaron funciones SQL `inventory_create_sale` ni `inventory_invoice_order`.
- No se toco `web/`.
- No se toco `backend-reporteria/`.
- No se agregaron migraciones, seeds ni cambios de SQL funcional.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cmd /c npx tsx --test src/modules/inventory/services/inventory-lot-balance.service.spec.ts` | PASO: 12 tests. |
| `cmd /c npx tsx --test src/modules/inventory/services/stock-movement-lot.service.spec.ts` | PASO: 8 tests. |
| `cmd /c npm run build` en `api/` | PASO: `tsc -p tsconfig.json`. |
| `cmd /c npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts src/modules/inventory/services/inventory-lot-balance.service.spec.ts src/modules/inventory/services/stock-movement-lot.service.spec.ts` | PASO: 67 tests. |
| `cmd /c openspec validate fortalecer-productos-inventario --type change --strict --json` | PASO: 1 change valido, 0 issues. |
| `git diff --check` | PASO. Git mostro advertencias CRLF en archivos modificados previamente, sin errores de whitespace. |

## Riesgos vivos

- RIESGO: Los metodos internos de saldos aun no estan integrados en una transaccion con compras, ventas, pedidos o ajustes.
- RIESGO: `inventory_lot_balances` es proyeccion operativa; falta job o proceso de reconciliacion contra `stock_movements` y `stock_movement_lots`.
- RIESGO: FEFO aun no esta activo; los endpoints nuevos solo consultan datos preparados.
- RIESGO: La validacion tenant-aware sigue reforzada en service; FKs compuestas tenant-aware quedan como endurecimiento futuro.

## Proximos pasos

1. Fase 3.6 o siguiente: definir historial de precios o integracion de compras segun prioridad aprobada.
2. Cuando se integren compras/ventas, ejecutar saldos y `stock_movement_lots` dentro de la misma transaccion que `stock_movements`.
3. Agregar reconciliacion operativa antes de activar FEFO.
4. Mantener productos legacy sin lote compatibles hasta completar estrategia de transicion.
