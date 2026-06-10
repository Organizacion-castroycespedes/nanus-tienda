# Evidencia: unificacion flujo venta v2 - Fase 4.R2

## Resumen ejecutivo

Se unifico el camino normal de `POST /api/sales` para usar `inventory_create_sale_v2` como funcion principal desde `SaleRepository`.

Resultado: **Fase 4.R2 aprobada en API local sobre copia PRD**.

La funcion `inventory_create_sale` v1 no fue borrada ni modificada. Queda como respaldo tecnico/manual para una limpieza futura, pero ya no decide el flujo operativo normal.

## Que se unifico

- `SaleRepository.createSaleWithFunction` ahora resuelve siempre `inventory_create_sale_v2`.
- Se elimino la dependencia operativa de `INVENTORY_SALE_V2_ENABLED`.
- Se elimino la consulta a `tenants.config.inventory.saleV2Enabled` y `saleV2Branches` para decidir la funcion de venta.
- El contrato de entrada de `POST /api/sales` no cambio.
- El payload enviado a la funcion SQL no cambio.
- La respuesta esperada no cambio.

## Estado del flag

`INVENTORY_SALE_V2_ENABLED` queda obsoleto para el camino normal de venta.

Prueba API local ejecutada con:

```text
INVENTORY_SALE_V2_ENABLED=false
```

La venta loteada funciono igual porque `SaleRepository` ya usa `inventory_create_sale_v2` directamente.

## Respaldo tecnico

`inventory_create_sale` v1 sigue existiendo en base de datos y no fue tocada. No se borro, no se reemplazo y no se modifico.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/repositories/sale.repository.ts` | Camino normal usa `inventory_create_sale_v2`; se removio decision por flag/config tenant. |
| `api/src/modules/inventory/repositories/sale.repository.spec.ts` | Tests ajustados para validar v2 como camino normal sin flag. |
| `scripts/http/20260602_sale_v2_api_local_test.ts` | Script local adaptado a flujo unificado sin fallback operativo por sucursal. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Agregada Fase 4.R2 con criterios completados. |
| `docs/evidencia-unificacion-flujo-venta-v2-fase-4R2.md` | Evidencia de esta fase. |

## Pruebas ejecutadas

```powershell
cd api
npx tsx --test src/modules/inventory/repositories/sale.repository.spec.ts src/modules/inventory/services/sale.service.spec.ts
npm run build
```

```powershell
# Desde raiz, contra localhost y copia local manus_tienda_prd.
pg_dump -Fc ...
psql -f scripts/database/dev/20260602_fixture_sale_v2_api_local.sql

# API local con flag apagado explicitamente.
INVENTORY_SALE_V2_ENABLED=false PORT=4028 npx tsx src/main.ts

$env:API_BASE_URL='http://localhost:4028/api'
$env:NODE_ENV='development'
$env:JWT_SECRET='changeme'
cmd /c api\node_modules\.bin\tsx.cmd --tsconfig api\tsconfig.json scripts\http\20260602_sale_v2_api_local_test.ts

psql -f scripts/database/dev/20260602_fixture_sale_v2_api_local_cleanup.sql
```

Tambien se ejecuto:

```powershell
openspec validate fortalecer-productos-inventario --type change --strict --json
git diff --check
```

## Ambiente local

| Campo | Resultado |
| --- | --- |
| DB_HOST | `localhost` |
| DB_NAME | `manus_tienda_prd` |
| PostgreSQL | `16.12` |
| Tipo | QA local sobre copia PRD |
| PRD real | No tocado |
| API local | `http://localhost:4028/api` |
| Backup local | `C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_sale_v2_unified_20260528_193924.dump` |
| Cleanup fixture | `fixture_rows_remaining = 0` |
| Puerto API post-prueba | `PORT_4028_OPEN=False` |

## Resultado unitario

| Caso | Resultado |
| --- | --- |
| `SaleRepository` usa `inventory_create_sale_v2` sin flag | OK |
| `SaleRepository` usa `inventory_create_sale_v2` con flag `false` | OK |
| `SaleRepository` usa `inventory_create_sale_v2` con flag `true` | OK |
| `SaleRepository` ignora valor raro `TRUE` | OK |
| No consulta `tenants.config` para elegir funcion | OK |
| Payload de venta no cambia | OK |
| Cancelacion no loteada sigue sin mutar lotes | OK |
| Cancelacion loteada devuelve al mismo lote | OK |
| Cancelacion loteada crea `stock_movement_lots` IN | OK |
| Lote `CANCELLED` falla y hace rollback | OK |

## Resultado API local

| Escenario | Resultado | Evidencia |
| --- | --- | --- |
| A. Venta no loteada | OK | Venta `cbe66ca3-2aed-44f7-b2f3-74571377787d`, sin `stock_movement_lots`. |
| B. Venta loteada | OK | Venta `0d6d4a4e-0dbe-4500-9102-6d9f08d8b948`, lote `10 -> 6`. |
| C. Venta mixta | OK | Venta `5fc27cfa-ba69-40fc-9c1d-18d25727a1e4`, lote mixto `5 -> 3`. |
| D. Stock insuficiente | OK | Fallo esperado, rollback total, balance sin cambios. |
| E. Cancelacion loteada | OK | Lote original restaurado `10`. |
| F. Cancelacion mixta | OK | Lote mixto restaurado `5`. |
| G. Sucursal control no loteada | OK | Venta `22574b57-c4d8-4760-ab2a-8d46667eced4`, sin links loteados. |
| H. Reconciliacion | OK | `critical=0 high=0 discrepancies=0`. |

Logs locales sanitizados confirmaron que la API uso:

```text
Using inventory_create_sale_v2 for POS sale creation
```

## Confirmaciones de alcance

| Confirmacion | Resultado |
| --- | --- |
| `POST /api/sales` mantiene contrato | OK |
| POS UI no tocado | OK |
| `web/` no tocado en esta fase | OK |
| `backend-reporteria/` no tocado | OK |
| Compras no tocado | OK |
| Ajustes no tocado | OK |
| Pedidos no tocado | OK |
| `inventory_create_sale` v1 no tocada | OK |
| `inventory_invoice_order` no tocada | OK |
| PRD real no tocado | OK |
| No se ejecuto comando remoto | OK |
| No se expusieron tokens/JWT reales | OK |

## Observaciones

- El primer intento de prueba API fallo con `401 Token inválido` porque el guard JWT toma `JWT_SECRET` en import-time antes de la carga de `.env`; se repitio firmando el JWT local con el valor default usado por el proceso. No se documento ningun token real.
- El error de stock insuficiente queda registrado como error funcional esperado del escenario de rollback.

## Riesgos vivos

- v1 sigue existiendo como respaldo tecnico, pero no hay selector operativo normal hacia v1.
- Productos legacy con `requires_lot=true` y sin `inventory_lot_balances` fallaran en venta, como debe pasar para evitar stock loteado fantasma.
- Tickets/reportes siguen sin mostrar lote.
- `FOR UPDATE` puede esperar bajo concurrencia real.
- Fase 4.R amplia mantiene pendientes E2E de producto/compras/ajustes fuera de venta.

## Proximos pasos

1. Ejecutar validacion integral Fase 5 con producto, compras, ajustes y ventas en un solo circuito.
2. Definir plan de limpieza futura para retirar flag/config obsoleta de documentacion y ambientes.
3. Mantener v1 hasta cerrar ventana de rollback operativo.
