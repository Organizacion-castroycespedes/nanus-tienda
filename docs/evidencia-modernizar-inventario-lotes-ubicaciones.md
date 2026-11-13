# Evidencia — modernizar-inventario-lotes-ubicaciones

Estado: implementación de Fase 1B y Fase 1A en la rama `feature/develop/modernizar-inventario-lotes-ubicaciones` (base `develop` `c7b92144`), **sin commit**. QA manual pendiente.

Change OpenSpec: `openspec/changes/modernizar-inventario-lotes-ubicaciones/` (válido en strict, OpenSpec 2.0.0, Windows, 2026-11-13).

## Alcance implementado

- **1B (API, contrato aditivo):** `GET /inventory/lots` y `GET /inventory/lot-balances` agregan `productName` y `productSku` con `LEFT JOIN products` filtrado por `tenant_id`. Solo `findMany`; lecturas individuales, escrituras, filtros, orden y permisos sin cambios.
- **1A (web):** Lotes con búsqueda compacta y "Buscar" obligatorio, filtros colapsables con chips, Detalle como primera columna fija, nombre y SKU, KPI de alcance único (vendible / no vendible), errores visibles con "Reintentar", "Limpiar" que recarga, precarga desde URL. Modal operativo con proveedor, "Ver compra", "Ver ubicación", discrepancias y trazabilidad plegada. Ubicaciones con filtros colapsables, sucursal legible, "Ver lotes", aviso de saldo al inactivar y "Reactivar".

Sin cambios en `scripts/database/**`, migraciones, guards, permisos, POS, ventas, compras ni Electron.

## Pruebas automáticas

| Prueba | Entorno | Resultado |
|---|---|---|
| `openspec validate modernizar-inventario-lotes-ubicaciones --strict` | Windows | Válido |
| `tsx --test` specs nuevas de repositorio (`inventory-lot*.repository.spec.ts`) | Contenedor Linux con copia de `api/src` | 6/6 OK |
| `tsx --test` todas las specs de `api/src/modules/inventory` | Contenedor Linux | 278/297 OK; 19 fallos por dependencias ausentes en la copia (`exceljs`, `dotenv`, `class-transformer`, `@nestjs/platform-express`) y migraciones fuera de la copia. Pendiente repetir en Windows |
| `tsx --test` `web/modules/inventory/lots/*.spec.ts` + `list-filters.spec.ts` | Contenedor Linux | 37/37 OK |
| `tsc --noEmit` web (proyecto completo) | VM Linux | Sin errores en archivos del change; errores preexistentes en 12 specs ajenos |
| ESLint sobre archivos del change | VM Linux | Sin hallazgos |
| `git diff --check` sobre `api`, `web` y manifiesto | VM Linux | OK |
| Diagnóstico de gobernanza | VM Linux | Manifiesto válido; un solo dueño por archivo; `INVALID_CHANGE` solo por falta de CLI en la VM |
| `cd api && npm run build`, `cd web && npm run build`, `npx vitest run app/[tenant]/orders` | Windows | Pendiente |

## QA manual (pendiente)

| ID | Caso | Esperado | Resultado |
|---|---|---|---|
| QA-01 | Abrir Lotes | Sin consultas automáticas; "Presiona Buscar…" | |
| QA-02 | Buscar como `SUPER_ADMIN` con "Todas" | Nombre y SKU en todas las filas; columna Sucursal | |
| QA-03 | Buscar como `USER` | Solo su sucursal; sin columna Sucursal | |
| QA-04 | Buscar por SKU | La fila aparece | |
| QA-05 | Filtros ocultos con Estado y Ubicación aplicados | "Filtros (2)" y dos chips; "Quitar" recarga | |
| QA-06 | Lote vencido o bloqueado con saldo | Suma en "Disponible no vendible", alerta "No vendible" | |
| QA-07 | Conciliación caída (simular) | Tabla visible, aviso con "Reintentar" | |
| QA-08 | Modal | Proveedor por nombre, "Ver compra" abre la compra, trazabilidad plegada | |
| QA-09 | Ubicaciones → "Ver lotes" | Lotes con sucursal y ubicación precargadas; consulta al presionar Buscar | |
| QA-10 | Inactivar ubicación con saldo | Aviso con cantidad de saldos y unidades | |
| QA-11 | Reactivar ubicación | Mensaje de éxito; error del backend si el código está en uso | |
| QA-12 | Responsive 390×844, 768×1024, 1024×768, 1342×802 | Sin scroll horizontal global; Detalle fija | |
| QA-13 | Teclado y lector de pantalla | Nombres accesibles, `aria-expanded`, chips con "Quitar filtro …" | |
| QA-14 | Red en Lotes | Solo solicitudes `GET` | |
| QA-15 | Filtro Producto: escribir nombre o SKU (con/sin tildes), flechas + Enter, Escape, clic fuera; en 390×844 | Filtra en cliente, selecciona sin consultar hasta "Buscar", foco vuelve al disparador, desplegable sin desbordar | PASS (propietario, 2026-11-13) |
| QA-17 | Modal de lote: lote con varias compras y ubicaciones; usuario sin permiso de Compras; simular falla de trazabilidad | Compras, ubicaciones y movimientos en el modal, sin UUID ni enlaces; resumen de compra visible; "Reintentar" por sección | |

## Selector de productos con búsqueda (D12) — 2026-11-13, Windows

- `manus-control-center/web/components/design-system` revisado: no tiene selector con búsqueda. Se creó `web/components/design-system/SearchableSelect.tsx` (genérico) y se usa en el filtro Producto de `/inventory/lots`.

| Comando | Resultado |
|---|---|
| `openspec validate modernizar-inventario-lotes-ubicaciones --strict` | valid |
| `npx tsx --test components/design-system/SearchableSelect.spec.ts modules/inventory/lots/*.spec.ts modules/inventory/list-filters/*.spec.ts` | 45/45 OK |
| `npx tsx --test components/design-system/*.spec.ts app/*/orders/*.spec.ts` | 21/21 OK |
| `openspec_governance_diagnostic.py` con los archivos nuevos | `CURRENT_SINGLE_MATCH`, `REPOSITORY_GATE_STATUS=PASS` |
| `npm run lint` (web) | sin advertencias ni errores |
| `npm run build` (web) | OK |

## Indicadores con estándar de reportería (D13) — 2026-11-13, Windows

- Los 6 KPI de Lotes pasan de tarjetas de colores a la franja única `ReportSummary` (la de `/reporteria/compras`). `ReportSummary` se extendió de forma aditiva (`columns: 4 | 6`, `ariaLabel`, `title`/`detail`/`detailTitle` por segmento); los valores por defecto no cambian para los consumidores actuales.

| Comando | Resultado |
|---|---|
| `openspec validate modernizar-inventario-lotes-ubicaciones --strict` | valid |
| `npx tsx --test components/design-system/*.spec.ts modules/inventory/lots/*.spec.ts modules/inventory/list-filters/*.spec.ts app/*/orders/*.spec.ts` | 63/63 OK |
| `npx tsx --test modules/reporteria/**/*.spec.ts modules/reporteria/*.spec.ts` (regresión) | 23/23 OK |
| `openspec_governance_diagnostic.py` con `ReportSummary.tsx`/`.spec.ts` | `CURRENT_SINGLE_MATCH`, `REPOSITORY_GATE_STATUS=PASS` |
| `npm run lint` (web) | sin advertencias ni errores |
| `npm run build` (web) | OK |

QA-16 (manual): **PASS** (propietario, 2026-11-13). Franja de Lotes en 390×844 (2×3), 768×1024 (3×2), 1342×802 (1×6), claro/oscuro; `/reporteria/compras` idéntica a antes.

## Trazabilidad en el modal (D14, 2026-11-13)

- API: `GET /inventory/lots/:lotId/traceability` (solo lectura, `INVENTORY:READ`, alcance de `findById`).
- Pruebas en contenedor Linux: repositorios y servicio de lotes 28/28 (incluye 2 de trazabilidad en repositorio y 3 en servicio); web `modules/inventory/lots` + `list-filters` 43/43.
- `tsc --noEmit` de `api` (VM): sin errores. `tsc` de los archivos web del change y ESLint: sin hallazgos.
- Pendiente en Windows: pruebas completas y build de API y web; QA-17.
