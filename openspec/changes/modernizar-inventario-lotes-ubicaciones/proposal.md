## Why

Inventario > Lotes (`web/app/[tenant]/inventory/lots/page.tsx`) e Inventario > Ubicaciones (`web/app/[tenant]/inventory/locations/page.tsx`) funcionan, pero no son operables con eficiencia:

- Lotes muestra el producto como `compactId(productId)` cuando falla el catálogo, y para roles super el catálogo falla con frecuencia porque se pide `GET /products` sin `branchId` (el backend exige sucursal) y un único `Promise.all` arrastra también sucursales y ubicaciones.
- Los filtros ocupan media pantalla y siempre están visibles; la columna "Detalle" está al final de una tabla de 13 columnas.
- Los KPI se calculan sobre alcances distintos (lotes del servidor, filas visibles, conciliación) y los errores de conciliación y de ubicaciones se silencian.
- Ubicaciones conserva la grilla rígida que ya causó overflow en Lotes (`xl:grid-cols-[1fr_220px_180px_160px_auto_auto]`), muestra UUID cuando no resuelve la sucursal, no permite reactivar y no avisa al inactivar una ubicación con saldo.
- No hay navegación entre ubicaciones y lotes.

## What Changes

Se separa la iniciativa en fases explícitas. Esta propuesta cubre la **Fase 1A (UX/lectura, frontend)** y la **Fase 1B (contrato aditivo de solo lectura `productName`/`productSku`)**, aprobadas por el propietario el 2026-11-13. La Fase 2 transaccional queda fuera.

**Fase 1A — UX operativa (frontend, sin cambios de stock, esquema ni permisos)**
- Filtros colapsados por defecto reutilizando `CollapsibleFilterPanel` (sin modificarlo), con chips de filtros aplicados visibles aunque el panel esté oculto y búsqueda compacta siempre visible. La consulta sigue requiriendo "Buscar" (no hay carga automática).
- Tabla predominante; "Detalle" como primera columna con etiqueta accesible.
- Nombre comercial y SKU fiables: se usan `productName`/`productSku` de la Fase 1B; como respaldo, catálogo con `branchId` válido, `Promise.allSettled`, `GET /products/:id` para faltantes y estado explícito "Producto no disponible" en lugar del UUID.
- KPI y alertas con un único alcance (resultado aplicado): "Disponible vendible" (lote `ACTIVE` y no vencido, igual que la venta) y "Disponible no vendible" como indicadores.
- Errores de conciliación y de búsquedas auxiliares visibles y recuperables; "Limpiar" recarga en lugar de dejar datos inconsistentes.
- Modal de lote operativo: datos de operación primero, proveedor y compra de origen legibles (enlace a `/inventory/purchases?purchaseId=`), discrepancias del lote y trazabilidad técnica plegada.
- Ubicaciones: mismo patrón de filtros, sucursal legible, acción "Ver lotes", aviso no bloqueante de saldo al inactivar y reactivación usando el contrato existente `PUT /inventory/locations/:id` con `isActive: true`.
- Navegación Lotes ↔ Ubicaciones mediante parámetros de URL.
- Responsive (390 / 768 / 1024 / 1342) y accesibilidad (teclado, `aria-*`, estados no solo por color).

**Fase 1B — Contrato aditivo de identificación de producto (API, solo lectura)**
- `GET /inventory/lots` y `GET /inventory/lot-balances` agregan `productName: string | null` y `productSku: string | null` mediante `LEFT JOIN products` filtrado por `tenant_id`.
- Campos opcionales y aditivos: no se quitan ni renombran campos, no cambian filtros, permisos, guards, esquema ni escritura de stock. Clientes existentes (web, Electron) siguen funcionando si los ignoran.

**Fase 1C — Trazabilidad del lote en el modal (API de solo lectura, autorizada 2026-11-13)**
- `GET /inventory/lots/:lotId/traceability`: ubicaciones, compras y movimientos del lote, mismo permiso y alcance que el detalle de lote.
- El modal muestra esa información en línea, sin enlaces a otros módulos y sin UUID.

**Fase 2 — Transaccional (fuera de esta aprobación; requiere OpenSpec propio)**
- Evaluada en `design.md`: seriales de equipos de climatización, jerarquía de almacenes, reservas conectadas a pedidos/POS, traslados, garantías, conteos y resolución de discrepancias, bloqueo/cancelación de lotes desde UI, paginación de servidor y actualizaciones atómicas de saldos.

## Capabilities

### New Capabilities

- `inventory-lots-operational-view`: listado de lotes con filtros colapsables, búsqueda, columnas, identificación de producto, KPI y estados de error.
- `inventory-lot-detail-modal`: detalle operativo de lote con trazabilidad secundaria.
- `inventory-locations-operational-view`: listado y administración de ubicaciones con filtros colapsables, navegación a lotes, aviso de saldo y reactivación.
- `inventory-lot-product-identity-contract`: campos aditivos `productName`/`productSku` en los listados de lotes y saldos.
- `inventory-lots-locations-ux-guardrails`: garantías de que la Fase 1 no altera stock, esquema, permisos ni aislamiento por tenant, y de que el único cambio de contrato es el aditivo de la Fase 1B.

### Modified Capabilities

- Ninguna. `mejorar-responsive-filtros-lotes-inventario` (completo, no archivado) queda cubierto y superado en layout por este cambio; sus requisitos de no-overflow se mantienen.

## Impact

- Fase 1B (API): `api/src/modules/inventory/repositories/inventory-lot.repository.ts`, `inventory-lot-balance.repository.ts`, `entities/inventory-lot.entity.ts`, `entities/inventory-lot-balance.entity.ts` y sus `*.spec.ts`; tipos en `web/modules/inventory/services/inventory-lot.service.ts`.
- Fase 1A (frontend): `web/app/[tenant]/inventory/lots/page.tsx`, `web/app/[tenant]/inventory/locations/page.tsx`, `web/modules/inventory/components/InventoryLotDetailModal.tsx`, `web/modules/inventory/services/inventory-location.service.ts` (solo tipo opcional `isActive` en el payload de actualización, ya aceptado por el backend), nuevos helpers puros y specs en `web/modules/inventory/lots/` (ruta propuesta); nuevo componente reutilizable `web/components/design-system/SearchableSelect.tsx` y su spec (D12), usado en el filtro Producto de Lotes; extensión aditiva de `web/components/design-system/ReportSummary.tsx` (columnas 6, línea secundaria y tooltip opcionales, D13) para los indicadores de Lotes.
- Consume sin modificar: `web/modules/inventory/list-filters/**` (propiedad vigente de `mejorar-filtros-alcance-cobro-orders-purchases` en `scripts/governance/openspec-scope.json`).
- Sin cambios en SQL de esquema, migraciones, guards, `role_menu_permissions`, compras, ventas, POS ni Electron. En `api/` solo el `SELECT` de los listados de la Fase 1B y el endpoint de solo lectura de la Fase 1C (`inventory-lot.controller.ts`, `inventory-lot.service.ts`, `inventory-lot.repository.ts` y pruebas).
- Fase 2: impacto en API, esquema y concurrencia; se documenta pero no se autoriza aquí.
