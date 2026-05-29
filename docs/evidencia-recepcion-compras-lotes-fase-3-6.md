# Evidencia recepcion de compras con lotes - Fase 3.6

## Fecha y ambiente

- Fecha/hora: 2026-05-28 01:45:28 -05:00
- Ambiente: local/dev
- Alcance: `api/` modulo `inventory`, flujo `PurchaseService.receivePurchase`
- Cambio OpenSpec: `fortalecer-productos-inventario`

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/controllers/purchase.controller.ts` | Extiende payload de recepcion para aceptar datos de lote con nombres camelCase y snake_case. |
| `api/src/modules/inventory/services/purchase.service.ts` | Integra recepcion con producto loteado, lotes, balances y `stock_movement_lots` dentro de la transaccion existente. |
| `api/src/modules/inventory/services/inventory-lot.service.ts` | Agrega metodo interno `findOrCreateForPurchase` para crear/reutilizar lotes desde compras. |
| `api/src/modules/inventory/services/purchase.service.spec.ts` | Agrega tests unitarios de recepcion de compras con lotes y compatibilidad legacy. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.6 completada. |

## Cambios en payload de recepcion

El endpoint existente `POST /api/purchases/:id/receive` mantiene el payload actual:

```json
{
  "items": [
    {
      "product_id": "...",
      "quantity": 10
    }
  ]
}
```

Tambien acepta datos opcionales para productos loteados:

```json
{
  "items": [
    {
      "purchaseItemId": "...",
      "receivedQuantity": 10,
      "lotCode": "L-2026-001",
      "expirationDate": "2026-12-31",
      "locationId": "...",
      "unitCost": 1200
    }
  ]
}
```

Se soportan equivalentes snake_case: `purchase_item_id`, `received_quantity`, `lot_code`, `expiration_date`, `location_id`, `unit_cost`.

## Reglas implementadas

- Productos `requires_lot=false` siguen recibiendo compra como antes.
- Productos no loteados rechazan datos de lote en esta fase para evitar ambiguedad.
- Productos `requires_lot=true` exigen `lotCode`.
- Productos `requires_expiration=true` exigen vencimiento si el lote existente no tiene uno registrado.
- `lotCode` se normaliza con trim y uppercase.
- El lote se crea o reutiliza por `tenantId + branchId + productId + lotCode`.
- Lotes `BLOCKED` o `CANCELLED` no pueden recibir stock.
- Si el lote existente ya tiene `expirationDate`, una fecha distinta se rechaza.
- `unitCost` usa el valor del payload o el costo del item de compra.
- `locationId` es opcional; si llega, se valida al incrementar balance contra tenant/sucursal.
- Se incrementa `inventory_lot_balances.quantity_on_hand` solo por cantidad realmente recibida.
- Se crea `stock_movement_lots` con el `stockMovementId` del movimiento IN creado.
- No se crea `stock_movement_lots` para producto no loteado.
- Liquidacion parcial no crea lotes adicionales.

## Flujo transaccional

`PurchaseService.receivePurchase` ya usaba `client` con `BEGIN`, `COMMIT` y `ROLLBACK`.

La integracion nueva se ejecuta dentro de esa misma transaccion:

1. Bloquea compra con `FOR UPDATE`.
2. Lee items y politicas `requires_lot` / `requires_expiration`.
3. Crea `stock_movements` IN como ledger principal.
4. Actualiza `purchase_items.received_quantity`.
5. Si el producto requiere lote, crea/reutiliza `inventory_lots`.
6. Incrementa `inventory_lot_balances`.
7. Registra `stock_movement_lots`.
8. Actualiza estado de compra.

Si falla una validacion de lote, balance o ubicacion, se ejecuta `ROLLBACK`.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cmd /c npx tsx --test src/modules/inventory/services/purchase.service.spec.ts` | PASO: 34 tests. |
| `cmd /c npm run build` en `api/` | PASO: `tsc -p tsconfig.json`. |
| `cmd /c npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts src/modules/inventory/services/inventory-lot-balance.service.spec.ts src/modules/inventory/services/stock-movement-lot.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts` | PASO: 101 tests. |
| `cmd /c openspec validate fortalecer-productos-inventario --type change --strict --json` | PASO: 1 change valido, 0 issues. |
| `git diff --check` | PASO. Git mostro advertencias CRLF en archivos modificados, sin errores de whitespace. |

## Confirmacion de alcance

- No se toco `web/`.
- No se toco `backend-reporteria/`.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modificaron funciones SQL `inventory_create_sale` ni `inventory_invoice_order`.
- No se implemento FEFO.
- No se agregaron migraciones SQL ni seeds.
- No se toco pagos/caja.
- `stock_movements` sigue siendo ledger principal.

## Riesgos vivos

- RIESGO: La recepcion actual no implementa idempotencia completa; una doble recepcion enviada por el cliente seguiria dependiendo de las reglas existentes de cantidad pendiente.
- RIESGO: FEFO aun no esta activo; los saldos por lote ya reciben entradas, pero las salidas siguen en flujo legacy.
- RIESGO: Reconciliacion automatica entre `stock_movements`, `stock_movement_lots` e `inventory_lot_balances` sigue pendiente.
- RIESGO: Frontend aun no captura datos de lote; esta fase solo deja backend preparado.

## Proximos pasos

1. Implementar captura visual de lotes en recepcion de compras cuando se apruebe Fase 5.
2. Agregar reconciliacion operativa antes de activar FEFO.
3. Integrar ajustes de inventario con lotes antes de ventas POS.
4. Activar FEFO en POS y pedidos en fase separada, con pruebas de concurrencia.
