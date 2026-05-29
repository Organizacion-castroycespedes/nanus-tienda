# Evidencia pruebas inventory_create_sale_v2 - Fase 3.14

Fecha: 2026-05-28

Resultado final: APROBADO en local/dev.

## Ambiente usado

| Control | Resultado |
| --- | --- |
| Host | `localhost` |
| Puerto | `5432` |
| Base | `manus_tienda_prd` local |
| Direccion servidor | `::1/128` |
| PostgreSQL | `PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit` |
| Secretos | No impresos |

SUPUESTO: Aunque la base local se llama `manus_tienda_prd`, la conexion verificada fue local/dev por `localhost` y `::1/128`.

## Funciones verificadas

```text
inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)
inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)
inventory_invoice_order(uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb)
```

## Bug detectado y causa

La primera ejecucion de Fase 3.14 fallo en el primer consumo loteado.

Error:

```text
ERROR: la referencia a la columna tenant_id es ambigua
```

Causa:

`inventory_create_sale_v2` tenia un `UPDATE inventory_lot_balances` con columnas sin calificar en el `WHERE`. En PL/pgSQL, los nombres de salida de `RETURNS TABLE` tambien son variables, por lo que `tenant_id` podia referirse a una columna o a una variable.

## Correccion aplicada

Archivo corregido:

```text
scripts/database/migrations/20260602_inventory_create_sale_v2.sql
```

Cambios:

- `UPDATE inventory_lot_balances` ahora usa alias `ilb`.
- `ilb.tenant_id`, `ilb.branch_id`, `ilb.product_id`, `ilb.lot_id` e `ilb.quantity_available` quedan calificados.
- `UPDATE order_items` ahora usa alias `oi_update`.
- Conteos de `order_items` califican `oi.delivered_quantity` y `oi.ordered_quantity`.
- `UPDATE orders` ahora usa alias `o_update`.
- No cambio la firma.
- No cambio el retorno.
- No cambio el payload.
- No cambio reglas FEFO.
- No cambio v1 ni `inventory_invoice_order`.

## Scripts usados

| Archivo | Proposito |
| --- | --- |
| `scripts/database/dev/20260602_fixture_sale_v2_local.sql` | Crea fixture local controlado para venta v2. |
| `scripts/database/dev/20260602_fixture_sale_v2_local_cleanup.sql` | Elimina solo datos del fixture local. |
| `scripts/database/tests/20260602_inventory_create_sale_v2_local_test.sql` | Ejecuta escenarios A-H contra `inventory_create_sale_v2`. |

Los scripts incluyen guardia local: abortan si `inet_server_addr()` no parece local.

## Fixture usado

Tenant controlado:

```text
90000000-0000-0000-0000-000000000001
```

Incluye:

- tenant
- branch
- unit
- user
- auth session
- terminal
- POS session
- customer
- producto no loteado
- productos loteados
- lotes activos con vencimiento futuro
- lotes de prueba vencidos, `BLOCKED` y `CANCELLED`
- `inventory_lot_balances`
- `stock_movements IN`
- `stock_movement_lots` iniciales para reconciliacion

## Comandos ejecutados

Reaplicar funcion corregida:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260602_inventory_create_sale_v2.sql
```

Resultado:

```text
CREATE FUNCTION
```

Ejecutar pruebas:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/tests/20260602_inventory_create_sale_v2_local_test.sql
```

Resultado:

```text
A OK Venta no loteada crea sale, item y OUT sin stock_movement_lots.
B OK Venta loteada con un lote suficiente descuenta balance y crea link.
C OK Venta FEFO consume lote mas proximo y luego lote posterior.
D OK Venta mixta vende ambos productos y solo el loteado crea movement_lot.
E OK Stock loteado insuficiente falla y no deja sale/items/movements/links ni cambia balance.
F OK Lote vencido se excluye y no muta datos.
G OK Lotes BLOCKED/CANCELLED se excluyen y no mutan datos.
H OK Reconciliacion de lotes exitosos sin discrepancias.
```

Cleanup:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/dev/20260602_fixture_sale_v2_local_cleanup.sql
```

Resultado:

```json
{
  "fixture_lots": 0,
  "fixture_sales": 0,
  "fixture_products": 0,
  "fixture_sale_items": 0,
  "fixture_tenant_exists": false,
  "fixture_stock_movements": 0,
  "fixture_stock_movement_lots": 0
}
```

## Resultado por escenario

| Escenario | Resultado | Nota |
| --- | --- | --- |
| A. Venta no loteada | OK | Crea `sales`, `sale_items`, `stock_movements OUT` y no crea `stock_movement_lots`. |
| B. Venta loteada un lote suficiente | OK | Descuenta `inventory_lot_balances` y crea `stock_movement_lots`. |
| C. Venta varios lotes FEFO | OK | Consume primero lote con vencimiento mas cercano y luego el posterior. |
| D. Venta mixta | OK | Vende item loteado y no loteado; solo el loteado crea link. |
| E. Stock insuficiente loteado | OK | Falla y valida rollback total. |
| F. Lote vencido | OK | Se excluye y no muta datos. |
| G. Lote BLOCKED/CANCELLED | OK | Se excluye y no muta datos. |
| H. Reconciliacion | OK | Sin discrepancias para escenarios exitosos. |

## Conteos de prueba

Durante la prueba exitosa:

| Metrica | Valor |
| --- | --- |
| `before_sales` | 0 |
| `after_sales` | 4 |
| `before_sale_items` | 0 |
| `after_sale_items` | 5 |
| `before_stock_movements_out` | 0 |
| `after_stock_movements_out` | 5 |
| `before_stock_movement_lots` | 4 |
| `after_stock_movement_lots` | 8 |

Balances finales antes de cleanup:

| Lote | `quantity_on_hand` | `quantity_reserved` | `quantity_available` |
| --- | ---: | ---: | ---: |
| `S314-FEFO-A` | 0.00 | 0.00 | 0.00 |
| `S314-FEFO-B` | 2.00 | 0.00 | 2.00 |
| `S314-MIX-A` | 3.00 | 0.00 | 3.00 |
| `S314-ONE-A` | 6.00 | 0.00 | 6.00 |

## Confirmaciones finales

| Control | Resultado |
| --- | --- |
| v1 existe | OK |
| v2 existe | OK |
| `inventory_invoice_order` existe | OK |
| Backend sigue default v1 | OK |
| `SaleRepository` no se modifico en esta fase | OK |
| `web/` no se toco | OK |
| `backend-reporteria/` no se toco | OK |
| PRD no se toco | OK |
| Fixture local limpiado | OK |
| `npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json` | OK; hubo warnings de engine Node 18, pero la validacion paso |
| `git diff --check` | OK con warnings CRLF existentes |
| `npm run build` | No ejecutado; no se modifico codigo `api/` en esta fase |

## Riesgos vivos

- RIESGO: `inventory_create_sale_v2` ya pasa pruebas SQL locales, pero aun no fue probado via API HTTP.
- RIESGO: El flag `INVENTORY_SALE_V2_ENABLED` sigue global de proceso, no por tenant/sucursal.
- RIESGO: Cancelacion loteada sigue pendiente antes de activar v2 en operacion real.
- RIESGO: Productos legacy `requires_lot=true` sin saldos loteados fallaran por stock loteado insuficiente.

## Proximos pasos

1. Ejecutar prueba via API local con `INVENTORY_SALE_V2_ENABLED=true`.
2. Agregar prueba de venta desde pedido si se quiere cubrir `UPDATE orders`.
3. Disenar/implementar cancelacion loteada.
4. Mantener v2 apagada por defecto hasta completar pruebas de API y cancelacion.
