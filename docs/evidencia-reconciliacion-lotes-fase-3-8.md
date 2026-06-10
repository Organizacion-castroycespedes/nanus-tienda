# Evidencia reconciliacion de lotes - Fase 3.8

## Resumen

Fecha/hora de prueba: 2026-05-28 02:11:56 -05:00

Ambiente: local/dev.

Resultado: APROBADO.

## Archivos creados/modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/repositories/inventory-lot-reconciliation.repository.ts` | Repository solo lectura con consultas de resumen, discrepancias, producto y lote. |
| `api/src/modules/inventory/services/inventory-lot-reconciliation.service.ts` | Service de validacion de filtros, alcance por sucursal y severidades. |
| `api/src/modules/inventory/controllers/inventory-lot-reconciliation.controller.ts` | Controller solo lectura para diagnostico de lotes. |
| `api/src/modules/inventory/services/inventory-lot-reconciliation.service.spec.ts` | Tests unitarios de discrepancias, filtros y solo lectura. |
| `api/src/modules/inventory/inventory.module.ts` | Registro de controller, service y repository. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.8 como completada. |

## Endpoints agregados

| Metodo | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/inventory/lot-reconciliation/summary` | Resumen de entidades revisadas y conteos por severidad. |
| `GET` | `/api/inventory/lot-reconciliation/discrepancies` | Lista de discrepancias filtrable. |
| `GET` | `/api/inventory/lot-reconciliation/product/:productId` | Diagnostico de producto. |
| `GET` | `/api/inventory/lot-reconciliation/lot/:lotId` | Diagnostico de lote. |

Filtros soportados: `branchId`, `productId`, `lotId`, `from`, `to`, `onlyDiscrepancies`, `discrepancyType`.

## Tipos de discrepancias implementadas

| Tipo | Severidad |
| --- | --- |
| `LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK` | `HIGH` |
| `LOT_LINK_WITHOUT_MOVEMENT` | `HIGH` |
| `LOT_LINK_PRODUCT_MISMATCH` | `HIGH` |
| `LOT_LINK_TENANT_MISMATCH` | `CRITICAL` |
| `LOT_BALANCE_WITHOUT_LOT` | `HIGH` |
| `LOT_BALANCE_PRODUCT_BRANCH_MISMATCH` | `HIGH` |
| `LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID` | `CRITICAL` |
| `LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS` | `CRITICAL` |
| `EXPIRED_ACTIVE_LOT` | `WARNING` |
| `BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE` | `WARNING` |
| `LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK` | `HIGH` |

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd api && npm run build` | OK |
| `cd api && npx tsx --test src/modules/inventory/services/inventory-lot-reconciliation.service.spec.ts` | OK, 17 tests passed |
| `cd api && npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts src/modules/inventory/services/inventory-lot-balance.service.spec.ts src/modules/inventory/services/stock-movement-lot.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts src/modules/inventory/services/stock-adjustment.service.spec.ts src/modules/inventory/services/inventory-lot-reconciliation.service.spec.ts` | OK, 134 tests passed |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | OK, ejecutado despues de crear evidencia |
| `git diff --check` | OK, con warnings informativos CRLF en archivos ya modificados |

## Confirmacion de solo lectura

- El repository usa `SELECT` para resumen, discrepancias y detalles.
- El controller solo expone `GET`.
- No hay endpoint de fix/correccion.
- No se modifican `stock_movements`.
- No se modifican `stock_movement_lots`.
- No se modifican `inventory_lot_balances`.
- No se modifican `inventory_lots`.
- No se modifican productos.

## Confirmaciones de alcance

- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico `PurchaseService`.
- No se modifico `StockAdjustmentService`.
- No se modifico `StockMovementService`.
- No se modificaron funciones SQL `inventory_create_sale` ni `inventory_invoice_order`.
- No se agregaron migraciones SQL.
- No se agregaron seeds.
- No se activo FEFO.

## Riesgos vivos

- Las discrepancias se reportan, pero no se corrigen automaticamente.
- `from` y `to` filtran diagnosticos por fecha operativa/creacion segun cada fuente; para auditorias historicas profundas puede requerirse un reporte dedicado.
- Productos legacy activados a `requires_lot=true` pueden aparecer como discrepancia hasta que se defina estrategia de lote legacy o consumo legacy.
- Fase FEFO debe usar esta reconciliacion como gate operativo antes de activar descuento automatico.

## Proximos pasos

- Definir procedimiento manual para revisar y resolver discrepancias antes de FEFO.
- Decidir si Fase futura necesita endpoint/admin job de correccion asistida.
- Usar summary/discrepancies como precheck antes de activar ventas POS con FEFO.
