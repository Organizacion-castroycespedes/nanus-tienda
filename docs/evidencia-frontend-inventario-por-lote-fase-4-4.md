# Evidencia frontend inventario por lote - Fase 4.4

## Resumen

Se agrego una vista web read-only para consultar inventario por lote, saldos por lote, vencimientos y discrepancias visuales.

Ruta creada:

- `web/app/[tenant]/inventory/lots/page.tsx`

La fase no modifica `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/app/[tenant]/inventory/lots/page.tsx` | Nueva pantalla read-only de inventario por lote. |
| `web/modules/inventory/services/inventory-lot.service.ts` | Cliente API y tipos frontend para lotes, saldos y reconciliacion. |
| `web/modules/inventory/components/InventoryLotDetailModal.tsx` | Modal de detalle rapido lote/balance. |
| `web/lib/route-permissions.ts` | Se agrego permiso de lectura para `/[tenant]/inventory/lots`. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Se marco Fase 4.4 como completada. |
| `docs/evidencia-frontend-inventario-por-lote-fase-4-4.md` | Evidencia de esta fase. |

## Endpoints consumidos

| Metodo | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/inventory/lots` | Lista de lotes con filtros de sucursal, producto, estado y vencimiento. |
| `GET` | `/api/inventory/lots/:lotId` | Cliente disponible para detalle futuro. |
| `GET` | `/api/inventory/lot-balances` | Saldos por lote, producto, sucursal y ubicacion. |
| `GET` | `/api/inventory/lot-balances/:balanceId` | Cliente disponible para detalle futuro. |
| `GET` | `/api/inventory/lot-reconciliation/summary` | Resumen de discrepancias criticas/altas. |
| `GET` | `/api/inventory/lot-reconciliation/discrepancies` | Alertas visuales por lote cuando hay discrepancias. |

## Componentes agregados

- `InventoryLotDetailModal`: detalle rapido read-only con lote, saldo, ubicacion, fechas, proveedor/compra e IDs tecnicos.
- Vista `InventoryLotsPage`: filtros, cards de resumen, tabla y paginacion.

## Tipos agregados

- `InventoryLotResponse`
- `InventoryLotBalanceResponse`
- `InventoryLotStatus`
- `InventoryLotReconciliationSummary`
- `InventoryLotDiscrepancy`

Estados soportados:

- `ACTIVE`
- `EXPIRED`
- `BLOCKED`
- `CONSUMED`
- `CANCELLED`

## Filtros creados

- Sucursal.
- Producto.
- Estado de lote.
- Vencimiento desde.
- Vencimiento hasta.
- Ubicacion.
- Solo disponibles.
- Busqueda por lote, producto, sucursal o ubicacion.

La busqueda visual por producto/sucursal/ubicacion se resuelve en frontend con los labels cargados. El backend soporta busqueda por `lotCode`; mejora futura: endpoint enriquecido con nombres.

## Badges implementados

- Vigente.
- Proximo a vencer.
- Vencido.
- Bloqueado.
- Cancelado.
- Sin stock.
- Disponible.
- Legacy.
- Discrepancias por severidad.

Regla visual:

- Vencido: `expirationDate < hoy`.
- Proximo a vencer: vencimiento entre hoy y 30 dias.
- Vigente: vencimiento futuro mayor a 30 dias.
- Sin vencimiento: `expirationDate = null`.

## Cards superiores

- Lotes activos.
- Lotes vencidos.
- Proximos a vencer.
- Stock disponible total.
- Discrepancias criticas/altas.

## FEFO preview

No se agrego UI de FEFO preview en esta fase. Queda como Fase 4.4.1 porque requiere flujo adicional de producto/sucursal/cantidad y manejo de errores funcionales sin mezclarlo con la consulta principal.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd web && npx tsc --noEmit --pretty false` | OK |
| Build en copia temporal completa de `web/` con `npm run build` | OK |
| `cd web && npm run lint` con `CI=1` | Bloqueado por setup interactivo de Next ESLint. |
| `npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json` | OK |
| `git diff --check` | OK, solo warnings de line endings existentes. |

## Validacion manual

Pendiente con API levantada:

- Abrir `/[tenant]/inventory/lots`.
- Consultar lotes sin filtros.
- Filtrar por sucursal.
- Filtrar por producto.
- Filtrar por estado.
- Filtrar por rango de vencimiento.
- Filtrar por ubicacion.
- Activar "Solo disponibles".
- Abrir detalle rapido de un lote con saldo.
- Ver cards de reconciliacion cuando backend responda summary/discrepancies.

## Confirmaciones de alcance

- No se toco `api/`.
- No se toco `backend-reporteria/`.
- No se toco `scripts/database/`.
- No se toco SQL ni migraciones.
- No se toco POS.
- No se toco compras.
- No se toco pedidos.
- No se toco reporteria.
- La vista no edita lotes ni saldos.

## Riesgos vivos

- Las respuestas actuales no incluyen nombres enriquecidos de producto, sucursal o ubicacion; la vista cruza datos con endpoints existentes y muestra ID compacto si falta label.
- `npm run lint` sigue interactivo porque no existe configuracion ESLint persistente.
- FEFO preview queda pendiente para una microfase separada.
- Si un usuario sin rol global no tiene `currentBranch`, el backend puede exigir `branchId`.

## Proximos pasos

- Fase 4.4.1: FEFO preview visual read-only.
- Fase futura: recepcion de compras con lote/vencimiento/ubicacion en web.
- Fase futura: ajustes con lote y ubicacion en web.
- Fase futura: reportes de inventario por vencimiento/valorizado en `backend-reporteria`.
