# Evidencia backend ajustes de inventario con lotes - Fase 3.7

## Resumen

Fecha/hora de prueba: 2026-05-28 01:58:42 -05:00

Ambiente: local/dev.

Resultado: APROBADO.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/controllers/stock-adjustment.controller.ts` | Extiende payload y delega el ajuste a `StockAdjustmentService`. |
| `api/src/modules/inventory/services/stock-adjustment.service.ts` | Nuevo servicio transaccional para ajuste manual con lotes. |
| `api/src/modules/inventory/services/inventory-lot.service.ts` | Agrega metodos internos para ajuste `IN` y `OUT`. |
| `api/src/modules/inventory/inventory.module.ts` | Registra `StockAdjustmentService`. |
| `api/src/modules/inventory/services/stock-adjustment.service.spec.ts` | Agrega pruebas unitarias de ajustes con lotes. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.7 como completada. |

## Cambios en payload de ajuste

El endpoint actual `POST /api/stock-adjustments` mantiene los campos existentes:

| Campo | Estado |
| --- | --- |
| `productId` | existente |
| `branchId` | existente |
| `type` | existente, `IN` o `OUT` |
| `quantity` | existente |
| `reason` | existente |

Campos nuevos opcionales para productos loteados:

| Campo | Uso |
| --- | --- |
| `lotCode` | Obligatorio cuando `products.requires_lot=true`. Se normaliza trim/uppercase. |
| `expirationDate` | Obligatorio en ajuste `IN` cuando `products.requires_expiration=true`. |
| `locationId` | Opcional. Debe pertenecer al tenant y sucursal via servicios de saldo. |
| `unitCost` | Opcional en ajuste `IN`; si no llega usa `products.cost` o `0`. |

## Reglas implementadas

- Producto sin lote (`requires_lot=false`) mantiene flujo actual de `stock_movements`.
- Producto sin lote rechaza datos de lote para evitar ambiguedad.
- Producto loteado exige `lotCode`.
- Producto loteado con vencimiento exige `expirationDate` en ajuste `IN`.
- Ajuste `IN` crea o reutiliza `inventory_lots`.
- Ajuste `IN` rechaza lote `BLOCKED` o `CANCELLED`.
- Ajuste `IN` incrementa `inventory_lot_balances`.
- Ajuste `OUT` exige lote existente.
- Ajuste `OUT` rechaza lote `BLOCKED`, `CANCELLED` o `CONSUMED`.
- Ajuste `OUT` valida disponibilidad mediante `InventoryLotBalanceService.decrementOnHand`.
- Ajuste `OUT` permite retirar lote vencido como correccion fisica.
- Ajuste loteado crea `stock_movement_lots` con el `stockMovementId` generado.
- Producto no loteado no crea `stock_movement_lots`.

## Flujo transaccional

`StockAdjustmentService.create` usa `DatabaseService.getClient()` y ejecuta:

1. `BEGIN`.
2. Lee politica del producto (`requires_lot`, `requires_expiration`, `cost`).
3. Valida payload de lote.
4. Crea `stock_movements` con `StockMovementService.createMovement`.
5. Para producto loteado, actualiza lote, saldo y vinculo movimiento-lote.
6. `COMMIT`.
7. Registra auditoria del movimiento despues del commit.

Si alguna validacion falla, ejecuta `ROLLBACK`. Asi se evita dejar `stock_movements` huerfanos si falla lote/saldo/vinculo.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd api && npm run build` | OK |
| `cd api && npx tsx --test src/modules/inventory/services/stock-adjustment.service.spec.ts` | OK, 16 tests passed |
| `cd api && npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts src/modules/inventory/services/inventory-lot-balance.service.spec.ts src/modules/inventory/services/stock-movement-lot.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts src/modules/inventory/services/stock-adjustment.service.spec.ts` | OK, 117 tests passed |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | OK, valid=true |
| `git diff --check` | OK, con warnings informativos CRLF en archivos ya modificados |

## Confirmaciones de alcance

- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modificaron funciones SQL `inventory_create_sale` ni `inventory_invoice_order`.
- No se modifico logica FEFO.
- No se modifico recepcion de compras salvo reutilizacion de servicios ya existentes.
- No se modificaron pagos/caja.
- No se agregaron migraciones SQL.
- No se agregaron seeds.

## Riesgos vivos

- `reason` ya existia en payload, pero el flujo actual no tiene persistencia formal de tabla `stock_adjustments`; el movimiento mantiene `referenceType=ADJUSTMENT` y `referenceTable=stock_adjustments`.
- La idempotencia de ajustes manuales no queda resuelta en esta fase.
- `inventory_lot_balances` empieza a reflejar ajustes loteados, pero el stock operativo principal sigue siendo `stock_movements`.
- FEFO sigue pendiente para ventas POS y pedidos; esta fase no descuenta por FEFO.

## Proximos pasos

- Fase 3.8 o siguiente: definir historial de precios o FEFO segun prioridad.
- Antes de FEFO, definir si ventas POS deben seleccionar lote automaticamente o permitir seleccion asistida.
- Definir persistencia formal de motivo de ajuste si negocio necesita auditoria detallada fuera de `stock_movements`.
