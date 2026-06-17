# Evidencia POS classification filters and effective images - Fase 6.9.9

## Estado

Fase 6.9.9: POS filtros por categoria/subcategoria + imagen efectiva.

Estado tecnico: PASS.
QA manual local: PASS.

## Discovery

- `git status --short`: limpio al iniciar.
- HEAD inicial: `c454fb7 feat(inventory): add local image uploads for product classification`.
- Ruta POS real: `/{tenantId}/pos`, implementada en `web/app/[tenant]/pos/page.tsx`.
- Pantalla POS: `web/modules/pos/components/PosScreen.tsx`.
- POS carga productos con `getPosProducts(activeBranchId)` desde `/products?branchId=...`.
- POS carga clientes e impuestos junto con productos.
- Filtros existentes: busqueda local y chips de stock `Todos`, `Con stock`, `Stock bajo`, `Sin stock`.
- El carrito POS vive en `posCart` y se preserva al filtrar productos.
- `ProductResponse` ya expone `categoryId`, `subcategoryId`, `imageUrl`, `imageAltText` y metadata de imagen.
- Backend `/products` no devuelve nombres ni default images de categorias/subcategorias.
- POS debe cargar categorias/subcategorias con `web/modules/inventory/services/product-classification.service.ts`.
- `InventoryImagePreview` ya usa `apiBlobClient`, por lo que la preview es autenticada y no expone ruta fisica.

## Implementacion

Archivos frontend modificados:

- `web/modules/pos/components/PosScreen.tsx`
- `web/modules/inventory/components/InventoryImagePreview.tsx`

Archivos frontend creados:

- `web/modules/pos/utils/product-classification.ts`
- `web/modules/pos/utils/product-classification.spec.ts`

OpenSpec/evidencia:

- `openspec/changes/fortalecer-productos-inventario/specs/productos/spec.md`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-pos-product-classification-filters-images-fase-6-9-9.md`

## Filtros POS

- Se agrego selector de categoria con opcion `Todas las categorias`.
- Se agrego selector de subcategoria dependiente de categoria.
- La subcategoria queda deshabilitada si no hay categoria o si la categoria no tiene subcategorias.
- Cambiar categoria limpia subcategoria.
- Limpiar categoria limpia subcategoria.
- La seleccion mantiene busqueda, filtro stock y carrito.
- Los filtros se componen como:
  - busqueda
  - stock
  - categoria
  - subcategoria

## Imagen efectiva POS

Prioridad implementada:

1. Imagen propia del producto.
2. Imagen por defecto de subcategoria.
3. Imagen por defecto de categoria.
4. Fallback actual con iniciales.

`InventoryImagePreview` se reutiliza para:

- preview autenticado via blob API;
- fallback si la imagen no existe o falla;
- carga lazy opcional para evitar fetch/blob de tarjetas POS fuera de viewport.

## Seguridad y alcance

- No se agregaron permisos nuevos.
- No se agregaron migraciones.
- No se tocaron endpoints de upload.
- No se cambio storage local.
- No se tocaron impuestos.
- No se tocaron descuentos.
- No se toco inventario/stock.
- No se toco cobro/pagos.
- No se reescribio visualmente el POS.

## Pruebas ejecutadas

PASS:

- `cd web && npx.cmd tsx --test modules/pos/utils/product-classification.spec.ts`
- `cd web && npm.cmd run lint`
- `cd web && npm.cmd run build`
- `openspec.cmd validate fortalecer-productos-inventario --type change --strict`
- `git diff --check`

Notas:

- `npm.cmd run lint` y `npm.cmd run build` terminaron en PASS con warnings preexistentes de `react-hooks/exhaustive-deps` y `@next/next/no-img-element` fuera de los archivos modificados.
- `npm.cmd run build` compilo la ruta `/{tenant}/pos` correctamente.

## QA manual

PASS:

- Ruta validada: `/00000000-0000-0000-0000-000000000001/pos`.
- POS carga correctamente.
- Filtro categoria funciona.
- Filtro subcategoria dependiente funciona.
- Busqueda + categoria/subcategoria funciona.
- Stock filter + categoria/subcategoria funciona.
- Cambiar filtros no limpia carrito.
- Agregar producto filtrado al carrito funciona.
- Cambiar categoria limpia subcategoria invalida.
- Limpiar categoria limpia subcategoria.
- Imagen efectiva funciona con prioridad producto > subcategoria > categoria > fallback.
- Imagen rota usa fallback.
- Carrito sticky/floating sigue funcionando.
- F4 cobrar sigue funcionando.
- Scanner/Balanza compactos siguen funcionando.
- No se tocaron impuestos, descuentos, inventario/stock, cobro/pagos, migraciones ni storage.

## Pendientes explicitos

- QA manual local POS: PASS.
- No hay cambios de impuestos.
- No hay cambios de descuentos.
- No hay cambios de inventario/stock.
- No hay cambios de cobro/pagos.
