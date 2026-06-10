# Evidencia FEFO service preparatorio - Fase 3.9

## Resumen

Fecha/hora de prueba: 2026-05-28 02:20:41 -05:00

Ambiente: local/dev.

Resultado: APROBADO.

## Archivos creados/modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/repositories/inventory-fefo.repository.ts` | Repository solo lectura para producto, sucursal, ubicacion y balances elegibles. |
| `api/src/modules/inventory/services/inventory-fefo.service.ts` | Selector FEFO preparatorio con `selectLotsForConsumption`. |
| `api/src/modules/inventory/controllers/inventory-fefo.controller.ts` | Preview protegido por permisos `INVENTORY` lectura. |
| `api/src/modules/inventory/services/inventory-fefo.service.spec.ts` | Tests unitarios del selector FEFO. |
| `api/src/modules/inventory/inventory.module.ts` | Registro de controller, service y repository. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.9 como completada. |

## Endpoint preview

| Metodo | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/inventory/fefo/preview` | Previsualiza lotes a consumir sin mutar datos. |

Query params:

| Parametro | Estado |
| --- | --- |
| `branchId` | requerido |
| `productId` | requerido |
| `quantity` | requerido, mayor que cero |
| `locationId` | opcional |

## Reglas implementadas

- FEFO aplica solo a productos `requires_lot=true`.
- `quantity` debe ser mayor que cero.
- `productId` debe pertenecer al tenant.
- `branchId` debe pertenecer al tenant.
- `locationId`, si llega, debe pertenecer al tenant y sucursal.
- Selecciona por `expiration_date ASC`, `received_at ASC`, `lot_code ASC`, `id ASC`.
- Excluye lotes `BLOCKED`, `CANCELLED` y `CONSUMED`.
- Excluye lotes vencidos.
- Excluye balances con `quantity_available <= 0`.
- Limita por ubicacion cuando `locationId` viene.
- Para `requires_expiration=true`, rechaza inconsistencia si encuentra lote elegible sin `expirationDate`.
- Si no alcanza, responde `canFulfill=false`, `selectedQuantity` parcial y `missingQuantity`.

## Confirmacion de no mutacion

- No reserva inventario.
- No descuenta inventario.
- No crea `stock_movements`.
- No crea `stock_movement_lots`.
- No modifica `inventory_lot_balances`.
- No modifica `inventory_lots`.
- No modifica productos.
- El controller solo expone `GET`.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd api && npm run build` | OK |
| `cd api && npx tsx --test src/modules/inventory/services/inventory-fefo.service.spec.ts` | OK, 14 tests passed |
| `cd api && npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts src/modules/inventory/services/inventory-lot-balance.service.spec.ts src/modules/inventory/services/stock-movement-lot.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts src/modules/inventory/services/stock-adjustment.service.spec.ts src/modules/inventory/services/inventory-lot-reconciliation.service.spec.ts src/modules/inventory/services/inventory-fefo.service.spec.ts` | OK, 148 tests passed |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | OK, ejecutado despues de crear evidencia |
| `git diff --check` | OK, con warnings informativos CRLF en archivos ya modificados |

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
- No se integro FEFO a POS, ventas ni pedidos.

## Riesgos vivos

- El selector no bloquea ventas por si solo; solo prepara seleccion.
- La activacion real en POS/pedidos debe ejecutarse dentro de transaccion y con locking para evitar doble consumo concurrente.
- Productos `requires_expiration=true` con lotes sin fecha quedan como inconsistencia operativa.
- La estrategia de lote legacy sigue pendiente para stock historico al activar `requires_lot`.

## Proximos pasos

- Usar reconciliacion de Fase 3.8 como gate antes de activar FEFO real.
- Diseñar locking transaccional para consumo de lotes en POS.
- Integrar selector con ventas POS en fase posterior sin cambiar productos no loteados.
