# Evidencia fase 6.9.7 - CRUD productos con clasificacion

Fecha: 2026-06-17

Change OpenSpec: `fortalecer-productos-inventario`

## Estado inicial

- `git status --short`: vacio.
- `HEAD`: `5a0724d feat(web): add product classification management UI`.

## Discovery

- Ruta CRUD productos: `/{tenantId}/inventory/products`.
- Implementacion principal: `web/app/[tenant]/inventory/products/page.tsx`.
- Formulario create/edit: `web/modules/inventory/components/ProductForm.tsx`.
- Patron UX actual: `FocusActionLayout`; no se agregaron modales nuevos.
- Catalogos auxiliares actuales: `getUnits()` y `getTaxes()`.
- Payload producto usa camelCase: `categoryId` y `subcategoryId`.
- Backend `POST /api/products` y `PUT /api/products/:id` ya aceptaban `categoryId` y `subcategoryId`.
- Bug minimo detectado: `GET /api/inventory/products` no exponia `categoryId` ni `subcategoryId`.

## Componentes modificados

- `web/modules/inventory/components/ProductForm.tsx`
  - Agrega seccion compacta `Clasificacion`.
  - Categoria opcional.
  - Subcategoria opcional dependiente de categoria.
  - CTA secundaria hacia categorias cuando no existen categorias.
- `web/app/[tenant]/inventory/products/page.tsx`
  - Carga categorias/subcategorias con `product-classification.service.ts`.
  - Muestra categoria/subcategoria compacta en listado.
  - Incluye clasificacion en busqueda local.
- `web/domains/products/dtos.ts`
  - Agrega `categoryId` y `subcategoryId`.
- `web/modules/inventory/services/product.service.ts`
  - Agrega `categoryId` y `subcategoryId` al payload create/update.
- `web/modules/inventory/utils/product-classification.ts`
  - Agrega helpers para filtro dependiente, limpieza, validacion y payload.

## Backend minimo

- `api/src/modules/inventory/repositories/inventory.repository.ts`
  - Agrega `p.category_id` y `p.subcategory_id` a `GET /api/inventory/products`.
- `api/src/modules/inventory/services/inventory.service.ts`
  - Mapea `categoryId` y `subcategoryId`.
- No se crearon endpoints nuevos.
- No se crearon migraciones DB.

## Comportamiento categoria/subcategoria

- Producto puede guardarse sin categoria.
- Producto puede guardarse con categoria.
- Producto puede guardarse con categoria + subcategoria.
- Subcategoria queda deshabilitada si no hay categoria.
- Al cambiar o quitar categoria se limpia subcategoria invalida.
- Solo se muestran subcategorias de la categoria seleccionada.
- Si categorias fallan al cargar, el formulario permite guardar sin clasificacion.

## Validaciones

- Subcategoria sin categoria bloquea submit.
- Subcategoria fuera de la categoria seleccionada bloquea submit o se limpia.
- No doble submit durante guardado.
- Errores backend se muestran con mensaje legible.
- No se envian campos `image_*` desde UI.

## Rutas probadas

- `http://localhost:3029/00000000-0000-0000-0000-000000000001/inventory/products`
  - Resultado: PASS, HTTP 200.

## Comandos ejecutados

- `cd web && npx.cmd tsx --test modules/inventory/utils/product-classification.spec.ts`
  - Resultado: PASS, 8 tests.
- `cd api && npx.cmd tsx --test src/modules/inventory/services/inventory.service.spec.ts`
  - Resultado: PASS, 1 test.
- `cd web && npm.cmd run lint`
  - Resultado: PASS.
  - Nota: quedan warnings existentes fuera de esta fase.
- `cd web && npm.cmd run build`
  - Resultado: PASS.
- `cd api && npm.cmd run build`
  - Resultado: PASS.
- `openspec.cmd validate fortalecer-productos-inventario --type change --strict`
  - Resultado: PASS.
- `git diff --check`
  - Resultado: PASS.
  - Nota: PowerShell mostro warnings de CRLF.

## QA manual

- Estado: QA Manual PASS.
- Fase: 6.9.7 Adaptar CRUD de productos a categoria/subcategoria.
- Ruta validada: `/00000000-0000-0000-0000-000000000001/inventory/products`.
- Confirmado:
  - Crear producto sin categoria funciona.
  - Crear producto con categoria funciona.
  - Crear producto con categoria + subcategoria funciona.
  - Editar producto y asignar clasificacion funciona.
  - Cambiar categoria limpia subcategoria invalida.
  - Quitar categoria limpia subcategoria.
  - Listado muestra categoria/subcategoria de forma compacta.
  - Producto existente sin categoria sigue funcionando.
  - No se afectaron precio, impuestos, unidad, estado operativo, inventario/stock ni cobro.
- QA visual con sesion real realizado: PASS.
- Smoke HTTP de ruta productos realizado: PASS.

## Pendientes explicitos

- Upload real.
- Storage local.
- Imagen efectiva.
- Filtros POS por categoria/subcategoria.
- Cambios de impuestos.
- Cambios de descuentos.
- Cambios de inventario/stock.
- Cambios de cobro/pagos.
