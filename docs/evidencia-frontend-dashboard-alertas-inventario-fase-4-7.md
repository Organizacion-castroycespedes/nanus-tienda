# Evidencia frontend dashboard alertas inventario - Fase 4.7

## Objetivo

Fortalecer visualmente el dashboard y la vista de inventario por lote para mostrar alertas basicas de vencimiento, disponibilidad y discrepancias, sin modificar datos.

## Archivos modificados

- `web/modules/inventory/components/InventoryDashboard.tsx`
- `web/app/[tenant]/inventory/lots/page.tsx`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-frontend-dashboard-alertas-inventario-fase-4-7.md`

## Componentes agregados o mejorados

- `InventoryAlertCard` en dashboard de inventario.
- Cards read-only de alertas:
  - Lotes vencidos.
  - Proximos a vencer.
  - Lotes bloqueados/cancelados con saldo.
  - Discrepancias criticas.
  - Discrepancias altas.
  - Stock loteado disponible.
- Estado visual de reconciliacion:
  - Sin discrepancias.
  - Advertencias.
  - Con altas.
  - Critico.
- Accesos rapidos:
  - Ver inventario por lote.
  - Ver ubicaciones fisicas.
  - Ver productos loteados.
  - Ver discrepancias.
- Ayuda contextual read-only en `web/app/[tenant]/inventory/lots/page.tsx`.

## Endpoints consumidos

- `GET /api/inventory/lots`
- `GET /api/inventory/lot-balances`
- `GET /api/inventory/lot-reconciliation/summary`
- `GET /api/inventory/lot-reconciliation/discrepancies`

No se agrego accion de correccion automatica.

## Reglas visuales implementadas

- Vencido: lote con `status=EXPIRED` o `expirationDate` anterior a hoy.
- Proximo a vencer: `expirationDate` entre hoy y 30 dias.
- Bloqueado/cancelado con saldo: lote `BLOCKED` o `CANCELLED` con `quantityAvailable > 0`.
- Stock loteado disponible: suma de `quantityAvailable`.
- Reconciliacion critica/alta: tomada desde endpoint de summary o discrepancias.
- Si endpoints de alertas fallan, se muestra fallback y el dashboard operativo sigue visible.

## Comandos ejecutados

- `cd web && npx tsc --noEmit --pretty false`
- `cd web && npm run build` en copia temporal completa de `web/` sin `.next`
- `cd web && npm run lint`
- `openspec validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`

## Resultado build/lint

- TypeScript: aprobado.
- Build Next.js: aprobado.
- Lint: bloqueado por configuracion interactiva existente de `next lint`; pregunta `How would you like to configure ESLint?`. No se modifico configuracion ESLint.
- OpenSpec strict: aprobado.
- `git diff --check`: aprobado.

## Validaciones manuales

Pendientes de ejecutar con API local levantada:

- Dashboard carga sin romper.
- Cards muestran datos o cero.
- Acceso a inventario por lote funciona.
- Discrepancias se muestran si endpoint responde.
- No hay accion de edicion, descuento o correccion.

## Confirmaciones de alcance

- No se modifico `api/`.
- No se modifico `backend-reporteria/`.
- No se modifico `scripts/database/`.
- No se modifico SQL ni migraciones.
- No se modifico POS.
- No se modifico compras.
- No se modifico pedidos.
- No se modifico reporteria.

## Riesgos vivos

- Las alertas calculadas en frontend dependen de la respuesta de lotes, saldos y reconciliacion.
- Para SUPER_ADMIN sin sucursal seleccionada, la cobertura depende del alcance que aplique el backend por token/tenant.
- `Ver productos loteados` abre catalogo de productos; el filtro visual dedicado para `requiresLot` queda como mejora futura.
- `next lint` sigue requiriendo configuracion interactiva.

## Proximos pasos

- Validar visualmente con API local.
- Agregar filtros dedicados para productos loteados si se prioriza.
- Avanzar luego a historial de precios o reporteria de inventario.
