## Context

Discovery sobre `develop` = `origin/develop` = `c7b92144` (2026-11-12), rama de trabajo `feature/develop/modernizar-inventario-lotes-ubicaciones` creada desde ese commit, sin commits propios.

### Hallazgos verificados — Lotes (`web/app/[tenant]/inventory/lots/page.tsx`)

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| L1 | `productName` se resuelve con el catálogo y cae a `compactId(productId)`; el subtítulo muestra otra vez el UUID corto, nunca el SKU. | 255-259, 547, 876-877, 889-892 |
| L2 | Para roles super el catálogo se pide sin `branchId` (`branchId: !isSuperRole ? currentBranch : undefined`). `GET /products` exige sucursal (`getBranchId` lanza `branchId is required` si no hay `branchId` ni `request.context.branchId`). | page 297-300; `api/.../controllers/product.controller.ts` 136-142, 178-195 |
| L3 | `Promise.all` de sucursales + productos: si falla productos se descartan también las sucursales y no se cargan ubicaciones; el usuario solo ve un aviso genérico. | 295-323 |
| L4 | `GET /products` requiere `INVENTORY_PRODUCTS:READ`, mientras lotes requiere `INVENTORY:READ`; un rol con lotes y sin catálogo nunca verá nombres. Además calcula stock por producto (N+1) solo para resolver nombres. | `product.controller.ts` 180-184; `product.service.ts` 1018-1042 |
| L5 | El lookup de ubicaciones pide solo `isActive: true` y silencia errores; saldos en ubicaciones inactivas se muestran como UUID corto. | 275-288, 549-551, 880-883 |
| L6 | Columna "Detalle" al final (13 columnas). | 838-852, 933-938 |
| L7 | Filtros siempre visibles (10 controles) y banner informativo fijo. | 619-623, 662-820 |
| L8 | KPI con alcances distintos: activos/vencidos/próximos sobre `lots` (sin búsqueda, ubicación ni "solo disponibles"); stock sobre `visibleRows`; discrepancias sobre la conciliación (sucursal/producto/fechas). | 515-527, 650-658 |
| L9 | "Stock disponible" suma lotes vencidos o bloqueados; la venta solo considera lotes `ACTIVE` y no vencidos. | 524-527; `api/.../repositories/sale.repository.ts` ~472-485 |
| L10 | Conciliación con `.catch(() => null)` / `.catch(() => [])`: un fallo se ve como "-" o "sin discrepancias". | 390-396 |
| L11 | "Limpiar" cambia `appliedFilters` sin recargar: la tabla re-filtra en cliente datos traídos con los filtros de servidor anteriores. | 535-540 |
| L12 | La búsqueda no cubre SKU. | 447-468 |
| L13 | Lotes sin saldo generan fila con cantidades 0 y alerta "Sin stock". | 420-437, 565-568 |

### Hallazgos verificados — Ubicaciones (`web/app/[tenant]/inventory/locations/page.tsx`)

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| U1 | CRUD + inactivación ya existen (`InventoryLocationForm`, `FocusActionLayout`, `RowActionsMenu`). | 16-27, 332-398, 569-590 |
| U2 | Grilla rígida `xl:grid-cols-[1fr_220px_180px_160px_auto_auto]` (mismo patrón que causó overflow en Lotes). | 403 |
| U3 | Sucursal no resuelta se muestra como UUID. | 541-543 |
| U4 | No hay reactivación en UI, aunque el backend acepta `isActive: true` en `PUT` y valida unicidad de código. | 569-590; `api/.../services/inventory-location.service.ts` 315-352; controller 46-51 |
| U5 | Inactivar no verifica saldos; el backend tampoco. | 260-281; service 354-369 |
| U6 | Búsqueda doble (servidor + cliente) y "Limpiar" sin recarga. | 161-170, 201-215, 230-235 |
| U7 | Permisos UI `inventory.create` / `inventory.update`; backend `INVENTORY:WRITE` + roles `SUPER_ADMIN/SUPER_USER/ADMIN`. | 108-109; controller 145-195 |

### Contexto compartido

- `CollapsibleFilterPanel` (`web/modules/inventory/list-filters/CollapsibleFilterPanel.tsx` 25-76) ya implementa panel oculto por defecto, contenido montado con `hidden`, `aria-expanded`/`aria-controls` y preferencia en `localStorage`. Propiedad vigente: `mejorar-filtros-alcance-cobro-orders-purchases` (`scripts/governance/openspec-scope.json`, `current_ownership`).
- `Modal` (`web/components/design-system/Modal.tsx`) tiene `role="dialog"` y `aria-modal`, sin manejo de `Escape` ni foco atrapado (componente compartido: fuera de alcance).
- Menú: `INVENTORY_LOCATIONS` / `INVENTORY_LOTS` (`scripts/database/013_operational_menu_inventory_locations_lots_terminals.sql` 88-89) mientras los endpoints usan `menuKey: "INVENTORY"`. Riesgo de 403 a verificar en QA; no se cambia.
- Esquema (`scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`): `inventory_locations` plana por sucursal (128-139), `inventory_lot_balances` con `quantity_available` generado (159-173), `stock_movement_lots` (175-184). Sin seriales, jerarquía, traslados, garantías ni conteos.
- Endpoints de lectura disponibles: `/inventory/lots`, `/inventory/lot-balances`, `/inventory/lot-reconciliation/{summary,discrepancies,product/:id,lot/:id}`, `/stock-movement-lots/by-lot/:lotId`, `/products/:id`. Escritura existente no expuesta: `PATCH /inventory/lots/:id/{block,cancel}`.
- Compra de origen navegable: `purchases/page.tsx` lee `?purchaseId=` (221-222).
- `prior change` `mejorar-responsive-filtros-lotes-inventario`: completo, no archivado.

## Goals / Non-Goals

**Decisiones del propietario (2026-11-13)**: reactivación de ubicaciones en Fase 1 (sí); contrato aditivo `productName`/`productSku` (autorizado); "Buscar" obligatorio (sin carga automática); "Disponible no vendible" como KPI (sí). Prioridad de Fase 2 para climatización: pendiente.

**Goals (Fase 1)**
- Tabla como protagonista; filtros colapsados sin perder visibilidad de lo aplicado.
- Producto siempre identificado por nombre y SKU, o por un estado explícito; nunca por UUID en la vista operativa.
- KPI coherentes con un solo alcance y con la regla de venta.
- Errores visibles y recuperables.
- Ubicaciones con el mismo patrón, navegación a lotes, aviso de saldo y reactivación.
- Responsive y accesible.

**Non-Goals (Fase 1)**
- Cambios de SQL de esquema, migraciones, guards, roles o `role_menu_permissions`.
- Cambios de contrato distintos de los campos aditivos de D11.
- Escritura de stock, bloqueo/cancelación de lotes, reservas, traslados, conteos.
- Modificar `CollapsibleFilterPanel`, `list-filters.ts` o `Modal`.

## Decisions

### D1. Filtros colapsados con chips de aplicados
Ambas páginas envuelven sus filtros en `CollapsibleFilterPanel` (`storageKey`: `inventory-lots`, `inventory-locations`). La búsqueda queda fuera del panel, compacta y siempre visible, y aplica con Enter o "Buscar". Debajo del encabezado se renderizan, en la página (sin tocar el componente compartido), chips de filtros **aplicados** distintos del valor por defecto con botón "Quitar" por chip. El conteo usa `countActiveListFilters`. Alternativa descartada: extender `CollapsibleFilterPanel` con un slot de resumen (requiere transferir propiedad de `list-filters/**`).

### D2. Consulta solo con "Buscar" (decisión del propietario)
No hay carga automática. Al abrir la página, la búsqueda compacta y el botón "Buscar" están siempre visibles (fuera del panel colapsable), y el estado vacío dice "Presiona Buscar para consultar lotes y saldos." con el botón "Buscar" enfocable. Enter en la búsqueda equivale a "Buscar". Esto también acota el volumen, porque `/inventory/lots` no pagina (`inventory-lot.repository.ts` 185).

### D3. Identificación de producto
0. Fuente principal: `productName`/`productSku` de las respuestas de lotes y saldos (D11).
1. Respaldo (respuesta antigua, campo nulo): catálogo con `branchId` = sucursal aplicada ‖ `currentBranch` ‖ primera sucursal disponible (el backend devuelve todos los productos del tenant; la sucursal solo afecta el stock calculado).
2. `Promise.allSettled` para sucursales, productos y ubicaciones; cada fallo produce su propio aviso.
3. Para `productId` del resultado ausentes del catálogo, `GET /products/:id` con concurrencia limitada (4) y caché en memoria por sesión de página.
4. Si sigue sin resolverse: "Producto no disponible" + SKU "—" y causa en `title`/texto auxiliar (sin permiso de catálogo, eliminado, error). El UUID solo aparece en la trazabilidad técnica.
Con D11 el respaldo solo se usa si la API desplegada aún no expone los campos o el producto fue borrado físicamente; así se elimina en la práctica la dependencia de `INVENTORY_PRODUCTS:READ` y el N+1 de `listProducts`.

### D4. Columnas
Orden: Detalle · Producto (nombre + SKU) · Lote · Ubicación · Vencimiento (fecha + badge + días) · Estado · Disponible · Reservado · En mano · Alertas · Sucursal (solo si alcance "Todas") · Costo · Últ. mov. La primera columna es fija (`sticky left-0`) en el contenedor con scroll horizontal interno. Botón "Ver" con `aria-label="Ver detalle del lote {lotCode} de {producto}"`.

### D5. Alcance único de KPI
Todos los KPI se calculan sobre el resultado aplicado (filtros de servidor + filtros de cliente + búsqueda), contando lotes distintos:
- Lotes activos, vencidos (estado `EXPIRED` o fecha < hoy), próximos a vencer (0-30 días).
- **Disponible vendible**: suma de `quantityAvailable` de saldos con lote `ACTIVE` y no vencido (misma regla que `sale.repository.ts`).
- **Disponible no vendible** (KPI aprobado): resto de `quantityAvailable` positivo (vencido, bloqueado, cancelado), con desglose en el `title` y en la línea secundaria del segmento (D13).
- Discrepancias: segmento propio con rótulo "Conciliación · {sucursal} · {producto/fechas}", porque su alcance lo define el backend; estados "cargando", "error — Reintentar" y valor.
Funciones puras en `web/modules/inventory/lots/lot-metrics.ts` con pruebas unitarias.

### D6. Errores y "Limpiar"
- Conciliación: sin `.catch` silencioso; el fallo deja la tabla operativa y muestra aviso con "Reintentar".
- Lookup de ubicaciones: se cargan todas (activas e inactivas) para resolver nombres; el selector de filtro lista activas y marca "(inactiva)" si hay una aplicada.
- "Limpiar" restablece filtros y recarga si ya se había buscado (Lotes y Ubicaciones).
- Lotes sin saldo: cantidades "—" y alerta "Sin saldo registrado" (distinta de "Sin stock" = saldo 0).

### D7. Modal operativo
Secciones en orden: (1) cabecera con producto, SKU, lote, estado y vencimiento con días; (2) cantidades (disponible destacado, reservado, en mano) y ubicación/sucursal; (3) origen: proveedor por nombre (`getSuppliers`, fallback "Proveedor no disponible"), fecha de recepción, costo, enlace "Ver compra" a `/{tenant}/inventory/purchases?purchaseId=…` si hay `purchaseId`; (4) discrepancias del lote ya cargadas (tipo, severidad, mensaje); (5) "Trazabilidad técnica" dentro de `<details>` cerrado. Acciones: "Ver ubicación" → `/inventory/locations?branchId=&search={code}`. Sin acciones de escritura.

### D8. Ubicaciones
- Filtros con D1; búsqueda solo en servidor (se elimina el filtro duplicado de cliente).
- Sucursal no resuelta: "Sucursal no disponible".
- Acción "Ver lotes" → `/{tenant}/inventory/lots?branchId={branchId}&locationId={id}`.
- Inactivar: antes de confirmar se consulta `GET /inventory/lot-balances?branchId&locationId&onlyAvailable=true`; si hay saldo, la confirmación indica "N saldos con X unidades disponibles seguirán asociados a esta ubicación". No bloquea (bloquear es regla de negocio: Fase 2).
- Reactivar: acción para inactivas con `inventory.update`, que llama `updateInventoryLocation(id, { isActive: true })`; un conflicto de código muestra el error del backend.

### D9. Estado en URL
Lotes lee `branchId`, `locationId`, `productId`, `status` desde `useSearchParams` al montar y los precarga como filtros (borrador y chips), **sin consultar**: respetando D2, el usuario presiona "Buscar". El estado vacío indica "Filtros precargados desde Ubicaciones. Presiona Buscar." Para roles no super, `branchId` distinto de la sucursal actual se ignora (el backend también lo rechaza).

### D10. Responsive y accesibilidad
- Sin overflow global en 390×844, 768×1024, 1024×768, 1342×802; scroll horizontal solo dentro de la tabla.
- `<table>` con `<caption class="sr-only">`, `th scope="col"`; badges con texto (no solo color); foco visible; región de avisos con `role="status"`/`role="alert"`; chips con `aria-label="Quitar filtro {nombre}"`.

### D11. Contrato aditivo `productName` / `productSku` (Fase 1B, autorizado)
- `InventoryLotRepository.findMany` y `InventoryLotBalanceRepository.findMany` agregan `LEFT JOIN products AS product ON product.id = <lot|balance>.product_id AND product.tenant_id = <lot|balance>.tenant_id` y seleccionan `product.name AS product_name`, `product.sku AS product_sku`. Solo los listados (únicos llamadores: `inventory-lot.controller.ts` 134 y `inventory-lot-balance.controller.ts` 108).
- Entidades: propiedades opcionales `productName: string | null` y `productSku: string | null`; `findById`, `create`, `update` y operaciones de cantidades devuelven `null` en ambos (sin `JOIN`), sin cambiar su comportamiento.
- `LEFT JOIN`: un producto inexistente no elimina filas; devuelve `null`. El filtro por `tenant_id` del `JOIN` impide mostrar nombres de otro tenant.
- Sin cambios en filtros, orden, permisos (`INVENTORY:READ`), guards ni escritura. Sin migración: `products.name` y `products.sku` existen.
- Compatibilidad: frontend con tipos opcionales (`productName?: string | null`) y respaldo D3 para despliegues desfasados web/API.
- Pruebas: SQL del listado contiene el `LEFT JOIN` con `tenant_id`; mapeo de filas con y sin producto; controlador expone los campos; regresión de specs existentes de lotes y saldos.

### D12. Selector de productos con búsqueda reutilizable
- Se revisó `D:\Profe\manus-control-center\web\components\design-system` (2026-11-13): no tiene selector con búsqueda (su `Select` es un `<select>` nativo, igual que el de este repo). Se crea `web/components/design-system/SearchableSelect.tsx` como componente genérico (no acoplado a productos) para reutilizarlo en otras vistas.
- Selección única; opción vacía opcional (`emptyOptionLabel`, p. ej. "Todos"); opciones `{ value, label, description?, keywords? }`.
- Filtrado en cliente sobre etiqueta, descripción (SKU) y palabras clave: sin distinguir mayúsculas ni tildes, todas las palabras en cualquier orden, primero las coincidencias al inicio de la etiqueta; máximo 50 resultados visibles con aviso "Mostrando N de M".
- Accesibilidad: disparador con `aria-haspopup="listbox"`/`aria-expanded`; búsqueda `role="combobox"` con `aria-activedescendant`; opciones `role="option"`/`aria-selected`; flechas, Inicio/Fin, Enter selecciona, Escape cierra y devuelve el foco, Tab y clic fuera cierran.
- Lógica pura exportada (`normalizeSearchText`, `filterSearchableOptions`, `getNextActiveIndex`) con pruebas `node:test`.
- `/inventory/lots` lo usa en el filtro Producto con el catálogo ya cargado (D3): nombre como etiqueta y SKU como descripción. Sin llamadas de red nuevas; respeta D2 (cambiar el producto solo modifica el borrador hasta "Buscar").

### D13. Indicadores con el estándar visual de reportería
- Los seis KPI de D5 se muestran con `ReportSummary` (`web/components/design-system/ReportSummary.tsx`), la franja única con divisiones de `/reporteria/compras`, en lugar de tarjetas de colores separadas. Mismos valores, rótulos y alcance (D5); sin íconos ni fondos por color.
- `ReportSummary` se extiende de forma **aditiva** y compatible: `columns?: 4 | 6` (4 por defecto, misma clase que hoy), `ariaLabel?` (por defecto "Resumen del reporte") y, por segmento, `title?`, `detail?` y `detailTitle?`. Los consumidores actuales (reportería, caja, control center) no cambian.
- Con 6 columnas: 2 en móvil, 3 desde `sm`, 6 desde `xl`; 6 es divisible por 2 y 3, así que no quedan celdas vacías en la franja.
- "Disponible no vendible" muestra el desglose (vencido / bloqueado / otros) como línea secundaria y en `title`; "Discrep. críticas / altas" conserva la línea "Conciliación · {alcance}".

### Evaluación enterprise (sin implementar)

| Capacidad | Estado | Evidencia | Comentario Fase 2 |
|-----------|--------|-----------|-------------------|
| Lotes y vencimientos | Existente | tablas `inventory_lots`, FEFO en venta | — |
| Ubicaciones físicas | Existente (plana) | `inventory_locations` 128-139 | — |
| Jerarquía de almacenes (bodega › zona › estante) | Nueva | sin `parent_id` | Requiere esquema, migración de saldos, reglas de agregación. |
| Seriales (equipos de climatización) | Nueva | sin tabla de seriales ni `requires_serial` | Entidad serial ↔ lote/ubicación, captura en compra, venta y devolución; impacta POS y facturación. |
| Reservas | Parcial | `reserve`/`releaseReservation` sin consumidores; `quantity_reserved` | Conectar con pedidos; corregir read-then-write. |
| Traslados entre ubicaciones/sucursales | Nueva | sin entidad de traslado | Documento con estados, movimientos OUT/IN atómicos. |
| Garantías | Nueva | sin modelo | Depende de seriales y de cliente/venta. |
| Conteos físicos | Parcial | importación de stock (`stock-import`, columna "conteo"), ajustes | Falta sesión de conteo, congelamiento, aprobación. |
| Detección de discrepancias | Existente | `inventory-lot-reconciliation` | Solo lectura. |
| Resolución de discrepancias | Nueva | sin flujo | Ajustes guiados con auditoría. |
| Bloqueo / cancelación de lote | Parcial | `PATCH /inventory/lots/:id/{block,cancel}` sin UI | Afecta disponibilidad vendible: Fase 2. |
| Bloqueo de inactivación con saldo | Nueva | service 354-369 | Regla de negocio. |
| Paginación de servidor de lotes/saldos | Nueva | sin `LIMIT` | Contrato aditivo. |
| Nombre/SKU en listados de lotes | Fase 1B | D11 | Aprobado 2026-11-13. |

### D14. Trazabilidad del lote dentro del modal (autorizado 2026-11-13)
- El modal deja de enlazar a Compras y Ubicaciones y de mostrar UUID. En su lugar carga `GET /inventory/lots/:lotId/traceability` al abrirse y muestra tres tablas: **Ubicaciones de este lote** (saldo por ubicación, marca la fila abierta), **Compras de este lote** (recepción, proveedor, factura, cantidad, costo, marca "Origen") y **Movimientos del lote** (fecha, entrada/salida, origen legible, factura, ubicación, cantidad con signo; máximo 200).
- Backend: `InventoryLotService.getTraceability` reutiliza `findById` (tenant y sucursal) y `InventoryLotRepository.findTraceability` ejecuta tres consultas de solo lectura con todas las uniones filtradas por `tenant_id`: saldos + `inventory_locations`; compras desde `stock_movement_lots` → `stock_movements` (`IN`, `PURCHASE`) → `purchases` → `suppliers`, más la compra de origen del lote; movimientos con `LIMIT 201` para detectar truncado.
- Una compra que reutiliza un código de lote existente aparece como compra adicional, aunque `inventory_lots.purchase_id` conserve la de origen.
- Permiso: `INVENTORY:READ`, igual que Lotes. Decisión del propietario: el resumen de compra (proveedor, factura, fecha, cantidad, costo) es visible sin `INVENTORY_PURCHASES:READ`; no se exponen totales ni pagos.
- Las entregas de pedidos sin vínculo de lote (defecto de `corregir-lotes-entrega-pedidos`) no aparecen como movimientos del lote hasta corregirse.

## Risks / Trade-offs

- **Concurrencia (Fase 2):** `incrementOnHand`, `decrementOnHand`, `reserve`, `releaseReservation` leen el saldo y escriben el valor absoluto (`inventory-lot-balance.repository.ts` 382-490, `UPDATE` 367) sin `FOR UPDATE` en el repositorio. Si el llamador no serializa (verificar bloqueo de producto en compra/ajuste, `product.repository.ts` 391), hay riesgo de actualización perdida. La Fase 1 no escribe saldos.
- **Volumen:** sin paginación de servidor, "Todas las sucursales" puede traer miles de filas; D2 evita consultas automáticas. Riesgo residual al buscar manualmente.
- **Contrato (D11):** el `JOIN` agrega costo a cada listado; se apoya en la PK de `products`. Clientes que validen el esquema de respuesta de forma estricta (no se encontró ninguno) tendrían que aceptar campos nuevos.
- **Catálogo:** el respaldo D3 agrega llamadas `GET /products/:id` solo cuando la API no trae los campos; con concurrencia limitada.
- **Preferencia de filtros:** se guarda por navegador; sin almacenamiento, oculto por defecto.
- **Propiedad de archivos:** solo se consume `list-filters/**`; si se requiere modificarlo, transferir propiedad antes.

## Migration Plan

Fase 1B (API) se despliega antes o junto con 1A; 1A tolera API sin los campos. Sin migraciones, variables de entorno ni seeds. Cambio registrado en `scripts/governance/openspec-scope.json`.

## Rollback

Revertir los commits de 1A y/o 1B por separado (1A funciona sin 1B gracias al respaldo D3). No hay datos que restaurar.

## Open Questions

1. Prioridad de Fase 2 para climatización (seriales + garantías frente a traslados + conteos). Se decide en el OpenSpec de Fase 2; no bloquea la Fase 1.

Resueltas el 2026-11-13: reactivación en Fase 1 (sí), contrato aditivo `productName`/`productSku` (sí), "Buscar" obligatorio (sí), KPI "Disponible no vendible" (sí).
