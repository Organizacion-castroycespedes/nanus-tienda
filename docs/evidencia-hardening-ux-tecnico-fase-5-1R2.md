# Evidencia - Fase 5.1.R2 Hardening UX tecnico previo a pricing

## Resumen ejecutivo

Se cerraron los riesgos vivos de Fase 5.1.R antes de iniciar pricing/promociones:

- `/inventory/lots` ya no renderiza opciones duplicadas en selects ni filas duplicadas por ids repetidos.
- El dashboard de inventario usa una key compuesta para discrepancias de reconciliacion sin identificador propio.
- Orders soporta producto con `price=0`: deja precio editable, muestra aviso discreto y no genera `NaN`.
- Purchases soporta producto con `cost=0`: deja costo editable, muestra aviso discreto y no genera `NaN`.
- `npm run lint` ya no abre prompt interactivo; se agrego configuracion minima de Next ESLint.

Decision final: **FASE 5.1.R2 APROBADA**.

## Ambiente usado

- QA local sobre copia PRD.
- DB_HOST: `localhost`.
- DB_NAME: `manus_tienda_prd`.
- PostgreSQL: 16.12.
- URL web local: `http://localhost:3000`.
- API local: `http://localhost:4020/api`.

No se toco PRD real ni servidor remoto.

## Resultado keys duplicadas

Archivo corregido:

- `web/app/[tenant]/inventory/lots/page.tsx`

Cambios:

- Se agrego helper `uniqueById`.
- Se deduplican sucursales, productos, ubicaciones, lotes y balances por `id`.
- La tabla mantiene key `row.key` basada en `lot.id` o `balance.id`.

Validacion UI:

- `/inventory/lots` cargo con selects sin valores duplicados.
- Validacion directa de DOM confirmo `dupes: []` en selects:
  - Sucursal.
  - Producto.
  - Estado.
  - Ubicacion.
  - Filas.

Nota:

- No habia filas de lote disponibles en el fixture al momento de validar, por eso no se abrio modal de detalle. La construccion de key de fila queda estable por `lot.id`/`balance.id`.

## Resultado dashboard inventario

Archivo corregido:

- `web/modules/inventory/components/InventoryDashboard.tsx`

Cambio:

- Las discrepancias de reconciliacion ahora usan key compuesta con:
  - `discrepancyType`
  - `severity`
  - `productId`
  - `lotId`
  - `balanceId`
  - `stockMovementId`
  - `stockMovementLotId`
  - `branchId`
  - `detectedAt`
  - indice local como desempate final.

Motivo:

- El endpoint puede devolver varias discrepancias legacy del mismo tipo sin `lotId`/`balanceId`, generando keys repetidas.

## Fixture producto sin price/cost

Archivos creados:

- `scripts/database/dev/20260529_fixture_phase_5_1r2_price_cost_local.sql`
- `scripts/database/dev/20260529_fixture_phase_5_1r2_price_cost_local_cleanup.sql`

Datos creados temporalmente:

- `S51R2 producto sin precio`
  - `price=0`
  - `cost=25`
- `S51R2 producto sin costo`
  - `price=50`
  - `cost=0`

El fixture valida servidor local con `inet_server_addr()` y aborta si no es local.

## Resultado producto sin price en Orders

Ruta:

- `/00000000-0000-0000-0000-000000000001/orders`

Validacion:

- Al seleccionar `S51R2 producto sin precio`, el campo `Precio` quedo vacio y editable.
- Aparecio aviso discreto:
  - `Este producto no tiene precio registrado. Ingresa el precio manualmente.`
- Al ingresar cantidad `2` y precio manual `1234`, el subtotal/total mostro `$ 2.468`.
- No aparecio `NaN`.

Resultado: OK.

## Resultado producto sin cost en Purchases

Ruta:

- `/00000000-0000-0000-0000-000000000001/inventory/purchases?action=create`

Validacion:

- Al seleccionar `S51R2 producto sin costo`, el campo `Costo` quedo vacio y editable.
- Aparecio aviso discreto:
  - `Este producto no tiene costo registrado. Ingresa el costo de compra.`
- Al ingresar cantidad `3` y costo manual `2222`, el subtotal/total mostro `$ 6.666`.
- No aparecio `NaN`.

Resultado: OK.

## Resultado fixture/cleanup

Comandos sanitizados:

```powershell
$env:PGPASSWORD='<LOCAL_PASSWORD>'; psql -h localhost -p 5432 -U postgres -d manus_tienda_prd -f scripts/database/dev/20260529_fixture_phase_5_1r2_price_cost_local.sql
$env:PGPASSWORD='<LOCAL_PASSWORD>'; psql -h localhost -p 5432 -U postgres -d manus_tienda_prd -f scripts/database/dev/20260529_fixture_phase_5_1r2_price_cost_local_cleanup.sql
```

Resultados:

- `fixture_rows_created = 3`.
- `fixture_rows_remaining = 0`.

## Resultado lint

Archivo creado:

- `web/.eslintrc.json`

Contenido:

```json
{
  "extends": "next/core-web-vitals"
}
```

Resultado:

- `npm run lint` ya no abre prompt interactivo.
- `npm run lint` termina con exit code 0.
- Quedan warnings preexistentes:
  - dependencias de hooks.
  - uso de `<img>` en algunas vistas.

No se corrigieron warnings porque no bloquean lint y requieren refactor fuera de esta fase.

## Comandos ejecutados

- `cd web && npm.cmd run lint` - OK, exit code 0 con warnings preexistentes.
- `cd web && npx.cmd tsc --noEmit --pretty false` - OK, exit code 0.
- `cd web && npm.cmd run build` - OK, exit code 0 con warnings preexistentes.
- `npx.cmd -y @fission-ai/openspec@1.3.1 validate fortalecer-productos-inventario --type change --strict --json` - OK, change valido.
- `git diff --check` - OK, exit code 0. Solo avisos CRLF de Git.

## Confirmaciones

- No PRD real.
- No servidor remoto.
- No `backend-reporteria/`.
- No SQL estructural.
- No migraciones productivas.
- No POS.
- No ventas.
- No `inventory_create_sale` v1/v2.

Nota de worktree:

- Existe cambio previo en `api/src/modules/inventory/controllers/product-barcode.controller.ts` por hotfix de barcode UUID. No fue parte de esta Fase 5.1.R2.

## Riesgos vivos

- Warnings de lint quedan como deuda tecnica no bloqueante.
- `/inventory/lots` no tenia filas de lote disponibles para abrir modal de detalle durante esta validacion puntual.
- El dashboard puede seguir mostrando discrepancias legacy reales; esta fase solo corrige key visual, no datos.

## Proximos pasos

- Iniciar Fase 6 de pricing/cambio de precio/promociones con lint ya no interactivo.
- Planear limpieza futura de warnings `react-hooks/exhaustive-deps` y `<img>`.
