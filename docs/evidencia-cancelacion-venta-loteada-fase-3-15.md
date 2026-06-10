# Evidencia cancelacion venta loteada - Fase 3.15

Fecha: 2026-05-28

Resultado final: APROBADO en local/dev.

## Ambiente usado

| Control | Resultado |
| --- | --- |
| Host | `localhost` |
| Puerto | `5432` |
| Base | `manus_tienda_prd` local |
| Direccion servidor | `::1/128` |
| NODE_ENV | `development` |
| PRD | No tocado |
| Secretos | No impresos |

SUPUESTO: Aunque la base local se llama `manus_tienda_prd`, la conexion validada fue local/dev por `localhost`, `::1/128` y `NODE_ENV=development`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/services/sale.service.ts` | Agrega reverso loteado dentro de `cancelSale` y corrige `FOR UPDATE OF s`. |
| `api/src/modules/inventory/services/sale.service.spec.ts` | Tests unitarios de cancelacion loteada/no loteada. |
| `scripts/database/tests/20260602_sale_v2_cancellation_local_test.ts` | Prueba local/dev real con `inventory_create_sale_v2` + `SaleService.cancelSale`. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.15 completada. |

## Flujo actual detectado

- `SaleController` llama `SaleService.cancelSale`.
- `cancelSale` abre transaccion con `client.query("BEGIN")`.
- La venta se bloquea por `sales`.
- Se leen `sale_items`.
- Se leen `stock_movements` OUT con `reference_type='SALE'`.
- Por cada item se crea `stock_movements` IN con `StockMovementService.createMovement`.
- Pagos/asignaciones/caja conservan el flujo existente.
- La venta pasa a `CANCELLED` o `REFUNDED`.

Bug real detectado en prueba local:

```text
FOR UPDATE no puede ser aplicado al lado nulable de un outer join
```

Causa: el `SELECT` de cancelacion usaba `LEFT JOIN customers` con `FOR UPDATE` sin limitar la tabla bloqueada.

Correccion: `FOR UPDATE OF s`, bloqueando solo `sales`.

## Cambios implementados

- Para cada movimiento OUT original se consultan sus `stock_movement_lots`.
- Si no hay links y el producto no requiere lote, no se toca lote/balance.
- Si no hay links y el producto `requires_lot=true`, falla con error funcional.
- Si hay links:
  - Valida lote existente.
  - Valida tenant, producto, sucursal y cantidad.
  - Rechaza lote `CANCELLED`.
  - Permite lote vencido, `EXPIRED` o `BLOCKED`.
  - Incrementa `inventory_lot_balances.quantity_on_hand`.
  - Inserta `stock_movement_lots` para el movimiento IN de reverso.
- Todo queda dentro de la misma transaccion de cancelacion.

## Resultado por casos A-K

| Caso | Resultado |
| --- | --- |
| A. Venta no loteada sigue igual | OK, no crea `stock_movement_lots` ni toca balances. |
| B. Venta loteada incrementa balance | OK, balance vuelve al valor previo. |
| C. Venta loteada crea links de reverso | OK, OUT e IN quedan con mismo lote y cantidad. |
| D. Venta mixta | OK, solo item loteado tiene links OUT/IN. |
| E. Lote vencido permite reverso | OK. |
| F. Lote `BLOCKED` permite reverso | OK. |
| G. Lote `CANCELLED` falla | OK, rollback mantiene venta no cancelada y balance sin mutacion extra. |
| H. Venta ya cancelada no duplica reverso | OK, segundo cancel no crea nuevos links. |
| I. Venta loteada sin `stock_movement_lots` | OK, falla seguro y no cancela. |
| J. Reconciliacion | OK, neto loteado de ventas canceladas exitosas queda en cero. |
| K. Pagos/caja | OK, fixture v2 no crea allocations de finance; flujo existente no se altera. |

## Comandos ejecutados

```text
psql -h <local> -p <local> -U <local> -d <local> -v ON_ERROR_STOP=1 -f scripts/database/dev/20260602_fixture_sale_v2_local.sql
cmd /c api\node_modules\.bin\tsx --tsconfig api\tsconfig.json scripts\database\tests\20260602_sale_v2_cancellation_local_test.ts
psql -h <local> -p <local> -U <local> -d <local> -v ON_ERROR_STOP=1 -f scripts/database/dev/20260602_fixture_sale_v2_local_cleanup.sql
cmd /c npx tsx --test src/modules/inventory/services/sale.service.spec.ts
cmd /c npx tsx --test src/modules/inventory/repositories/sale.repository.spec.ts
npm run build
cmd /c npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json
git diff --check
```

## Resultados

| Validacion | Resultado |
| --- | --- |
| Prueba local/dev cancelacion loteada | OK |
| Fixture cleanup | OK, `fixture_rows = 0` |
| `SaleService` unit tests | OK, 6/6 |
| `SaleRepository` flag tests | OK, 4/4 |
| Build `api/` | OK |
| OpenSpec validate | OK |
| `git diff --check` | OK con advertencias CRLF preexistentes |

## Confirmaciones

- `inventory_create_sale` v1 no fue modificado.
- `inventory_create_sale_v2` no fue modificado en esta fase.
- `inventory_invoice_order` no fue modificado.
- `SaleRepository` no fue modificado en esta fase.
- `INVENTORY_SALE_V2_ENABLED` sigue apagado por defecto.
- `web/`, `backend-reporteria/` y POS UI no fueron tocados.
- Compras, ajustes y pedidos no fueron tocados.
- No se ejecuto nada contra PRD.

## Riesgos vivos

RIESGO: Ventas loteadas legacy sin `stock_movement_lots` no pueden cancelarse automaticamente. Decision segura: fallar y exigir ajuste manual controlado.

RIESGO: Cancelacion con pagos finance reales no se cubrio con fixture v2 porque `inventory_create_sale_v2` registra `sale_payment_methods` legacy, no `payments/payment_allocations`.

RIESGO: v2 sigue detras de flag. La activacion por tenant/sucursal requiere fase separada con pruebas POS reales.

## Proximos pasos

- Fase 3.16 sugerida: prueba integral via API/HTTP con `INVENTORY_SALE_V2_ENABLED=true` en proceso local.
- Fase futura: estrategia para ventas loteadas legacy sin links.
- Fase futura: activacion gradual por tenant/sucursal, no global.
