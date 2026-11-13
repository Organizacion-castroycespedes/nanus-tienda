## 0. Discovery y gobernanza

- [x] 0.1 Inspeccionar `git status`, rama, `HEAD` y `origin/develop` (`c7b92144`); preservar cambios ajenos.
- [x] 0.2 Crear rama `feature/develop/modernizar-inventario-lotes-ubicaciones` desde `origin/develop` sin upstream.
- [x] 0.3 Revisar `AGENTS.md`, OpenSpec existente (`mejorar-responsive-filtros-lotes-inventario`, `mejorar-filtros-alcance-cobro-orders-purchases`, `openspec/specs/inventario`).
- [x] 0.4 Inspeccionar frontend, servicios, controladores, servicios y repositorios backend, esquema, permisos y dependencias de compras, ventas y POS.
- [x] 0.5 Redactar proposal, design, specs y tasks.
- [x] 0.6 `openspec validate modernizar-inventario-lotes-ubicaciones --strict` (OpenSpec 2.0.0, Windows, 2026-11-13): valid.
- [x] 0.7 Aprobación del propietario (2026-11-13): reactivación sí, contrato aditivo sí, "Buscar" obligatorio, KPI no vendible sí.
- [x] 0.8 Registrar el cambio en `scripts/governance/openspec-scope.json` (`changes` + `current_ownership`; `list-filters/**` solo lectura).

## 1B. Fase 1B — Contrato aditivo `productName`/`productSku` (API)

- [x] 1B.1 Prueba primero: specs de repositorio que exijan `LEFT JOIN products` con `tenant_id` en `findMany` de lotes y saldos, y mapeo con producto nulo.
- [x] 1B.2 `InventoryLotRepository.findMany`: `LEFT JOIN products`, columnas `product_name`, `product_sku`; mapeo a la entidad.
- [x] 1B.3 `InventoryLotBalanceRepository.findMany`: igual.
- [x] 1B.4 Entidades `InventoryLotEntity` e `InventoryLotBalanceEntity`: `productName`/`productSku` opcionales (`null` por defecto).
- [x] 1B.5 Tipos web `InventoryLotResponse` e `InventoryLotBalanceResponse`: `productName?: string | null`, `productSku?: string | null`.
- [x] 1B.6 `cd api && npx tsx --test src/modules/inventory/**/*.spec.ts` y `npm run build`.

## 1. Fase 1A — Lógica pura y pruebas

- [x] 1.1 Crear `web/modules/inventory/lots/lot-metrics.ts`: KPI de alcance único, disponible vendible / no vendible, días a vencer.
- [x] 1.2 Crear `web/modules/inventory/lots/lot-filters.ts`: valores por defecto, chips aplicados, lectura de filtros desde URL con regla de sucursal por rol.
- [x] 1.3 Crear `web/modules/inventory/lots/product-identity.ts`: resolución nombre/SKU desde la respuesta (1B), respaldo con catálogo y faltantes, y estado "no disponible".
- [x] 1.4 Pruebas unitarias `*.spec.ts` (node:test) para 1.1-1.3, incluido lote vencido con saldo, búsqueda por SKU, URL con sucursal ajena.

## 2. Fase 1 — Lotes

- [x] 2.1 Envolver filtros en `CollapsibleFilterPanel` (`storageKey: "inventory-lots"`), búsqueda compacta visible, chips con "Quitar".
- [x] 2.2 Carga de búsquedas auxiliares con `Promise.allSettled`, `branchId` válido para catálogo, ubicaciones activas e inactivas, avisos por fuente.
- [x] 2.3 Resolver productos faltantes con `GET /products/:id` (concurrencia 4, caché).
- [x] 2.4 Reordenar columnas (Detalle primero, fija) y nombre accesible del botón.
- [x] 2.5 KPI desde `lot-metrics.ts`; tarjeta de conciliación con alcance, error y "Reintentar".
- [x] 2.6 "Limpiar" recarga; lotes sin saldo con "—" y "Sin saldo registrado".
- [x] 2.7 Precargar filtros desde URL sin consultar; estado vacío "Presiona Buscar"; Enter en búsqueda = Buscar (D2, D9).
- [x] 2.8 Retirar banner fijo o convertirlo en texto auxiliar del encabezado.

## 3. Fase 1 — Modal de lote

- [x] 3.1 Reestructurar `InventoryLotDetailModal` en secciones operativas (D7).
- [x] 3.2 Proveedor por nombre (`getSuppliers`) y enlace "Ver compra".
- [x] 3.3 Discrepancias del lote y "Trazabilidad técnica" en `<details>`.
- [x] 3.4 Acción "Ver ubicación".

## 4. Fase 1 — Ubicaciones

- [x] 4.1 `CollapsibleFilterPanel` (`storageKey: "inventory-locations"`), búsqueda compacta, chips; eliminar grilla rígida.
- [x] 4.2 Búsqueda solo en servidor; "Limpiar" recarga.
- [x] 4.3 "Sucursal no disponible" en lugar de UUID.
- [x] 4.4 Acción "Ver lotes".
- [x] 4.5 Aviso de saldo antes de inactivar (`GET /inventory/lot-balances?locationId&onlyAvailable=true`).
- [x] 4.6 Reactivar (aprobado): tipo opcional `isActive` en `UpdateInventoryLocationPayload` y acción en `RowActionsMenu`.

## 5. Fase 1 — Validación (no afirmar PASS sin ejecución)

- [x] 5.1 `cd web && npx tsx --test modules/inventory/lots/*.spec.ts` (o runner vigente).
- [x] 5.2 Pruebas de layout por fuente (node:test, patrón de `orders-responsive-layout.spec.ts`; `modules/inventory/lots/lots-locations-layout.spec.ts`) para lotes y ubicaciones: panel colapsable, orden de columnas, ausencia de grilla rígida.
- [x] 5.3 Regresión: `list-filters.spec.ts`, `orders-responsive-layout.spec.ts`.
- [x] 5.4 `cd web && npm run lint` y `npm run build`.
- [x] 5.5 Backend acotado: `git diff --stat -- api` solo muestra los archivos de 1B; `git diff --stat -- scripts/database` vacío; regresión `cd api && npx tsx --test src/modules/inventory/**/*.spec.ts`.
- [x] 5.6 `git diff --check`.
- [ ] 5.7 QA responsive en 390×844, 768×1024, 1024×768, 1342×802 (Lotes, Ubicaciones, modal).
- [ ] 5.8 QA accesibilidad: navegación solo teclado, nombres accesibles, `aria-expanded`, contraste de badges, lector de pantalla en tabla y chips.
- [ ] 5.9 QA funcional por rol: `SUPER_ADMIN` (Todas / una sucursal), `ADMIN`, `USER`, rol sin `INVENTORY_PRODUCTS:READ`.
- [ ] 5.10 QA de errores: conciliación caída, catálogo caído, ubicación inactiva con saldo, lote sin saldo.
- [ ] 5.11 Verificar en red que Lotes solo emite `GET`.
- [x] 5.12 Evidencia en `docs/evidencia-modernizar-inventario-lotes-ubicaciones.md`.

## 7. Selector de productos con búsqueda (D12)

- [x] 7.1 Revisar `manus-control-center/web/components/design-system`: no existe selector con búsqueda.
- [x] 7.2 Crear `web/components/design-system/SearchableSelect.tsx` con helpers puros y `SearchableSelect.spec.ts` (node:test).
- [x] 7.3 Usarlo en el filtro Producto de `/inventory/lots`; prueba por fuente en `lots-locations-layout.spec.ts`.
- [x] 7.4 Registrar las rutas en `scripts/governance/openspec-scope.json`.
- [x] 7.5 QA manual: teclado, lector de pantalla, móvil 390×844 (el desplegable no desborda). PASS (propietario, 2026-11-13).

## 8. Indicadores con estándar de reportería (D13)

- [x] 8.1 Extender `ReportSummary` de forma aditiva (`columns`, `ariaLabel`, `title`, `detail`, `detailTitle`) con pruebas de compatibilidad.
- [x] 8.2 Reemplazar las tarjetas de KPI de `/inventory/lots` por `ReportSummary` (6 columnas) y retirar `SummaryCard`; prueba por fuente.
- [x] 8.3 Registrar `ReportSummary.tsx` y su spec en `scripts/governance/openspec-scope.json`.
- [x] 8.4 QA visual (PASS, propietario, 2026-11-13): Lotes en 390×844, 768×1024, 1024×768, 1342×802, tema claro/oscuro; `/reporteria/compras` sin cambios.

## 9. Trazabilidad en el modal (D14)

- [x] 9.1 `InventoryLotRepository.findTraceability` y pruebas (tenant en las tres consultas, mapeo, truncado a 200).
- [x] 9.2 `InventoryLotService.getTraceability` (alcance de `findById`) y pruebas (accesible, otro tenant, otra sucursal).
- [x] 9.3 `GET /inventory/lots/:lotId/traceability` con `INVENTORY:READ`.
- [x] 9.4 Web: `getInventoryLotTraceability`, `lots/lot-traceability.ts` (+spec) y modal con Ubicaciones, Compras y Movimientos; retirar UUID y enlaces "Ver compra"/"Ver ubicación".
- [x] 9.5 Registrar servicio, controlador y spec del servicio de lotes en `scripts/governance/openspec-scope.json`.
- [ ] 9.6 Windows: `cd api && npx tsx --test src/modules/inventory/**/*.spec.ts && npm run build`; `cd web && npm run lint && npm run build`.
- [ ] 9.7 QA-17 manual: lote con varias compras y ubicaciones; usuario sin permiso de Compras; falla de trazabilidad.

## 6. Fase 2 — Transaccional (FUERA DE ALCANCE; requiere OpenSpec propio)

- [ ] 6.1 Paginación de servidor de `/inventory/lots` y `/inventory/lot-balances`.
- [ ] 6.2 Actualizaciones atómicas de saldos (`SET quantity = quantity + $n` o `FOR UPDATE`) y pruebas de concurrencia.
- [ ] 6.3 Bloqueo/cancelación de lotes desde UI y regla de inactivación con saldo.
- [ ] 6.4 Reservas conectadas a pedidos/POS.
- [ ] 6.5 Traslados, conteos físicos y resolución de discrepancias.
- [ ] 6.6 Jerarquía de almacenes, seriales de climatización y garantías.
