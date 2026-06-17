# Evidencia fase 6.9.6 - UI categorias/subcategorias

Fecha: 2026-06-17

Change OpenSpec: `fortalecer-productos-inventario`

## Estado inicial

- `git status --short`: vacio.
- `HEAD`: `7fb773d fix(api): wire product classification into inventory module`.

## Rutas creadas

- `/{tenantId}/inventory/product-categories`
- `/{tenantId}/inventory/product-subcategories`

## Componentes y servicios

- `web/app/[tenant]/inventory/product-categories/page.tsx`
  - Listado, filtros, creacion, edicion, activacion y desactivacion de categorias.
  - Usa `FocusActionLayout` y confirmacion inline.
- `web/app/[tenant]/inventory/product-subcategories/page.tsx`
  - Listado, filtros por categoria, creacion, edicion, activacion y desactivacion de subcategorias.
  - Muestra CTA hacia categorias si no existen categorias.
- `web/modules/inventory/components/ProductCategoryForm.tsx`
  - Formulario inline sin modal.
- `web/modules/inventory/components/ProductSubcategoryForm.tsx`
  - Formulario inline sin modal y selector de categoria.
- `web/modules/inventory/services/product-classification.service.ts`
  - Cliente API para categorias y subcategorias.
- `web/modules/inventory/utils/product-classification.ts`
  - Helpers de slug, validacion basica, orden e iniciales visuales.

## UX sin modales

- Crear y editar usan formulario inline dentro de `FocusActionLayout`.
- Activar/desactivar usa `ConfirmationMessage` inline.
- El listado queda como contexto principal y se recupera al cancelar o guardar.
- Las imagenes usan placeholder/iniciales o `default_image_url` existente.
- No se agrego selector de archivos.

## Permisos frontend

- Las vistas usan `MENU_KEYS.INVENTORY_PRODUCTS` con `hasMenuAccess`.
- READ habilita acceso a la ruta.
- WRITE habilita crear, editar, activar y desactivar.
- No se crearon permisos nuevos.
- Las rutas ya existentes `INVENTORY_PRODUCT_CATEGORIES` e `INVENTORY_PRODUCT_SUBCATEGORIES` quedan como navegacion/menu.

## Validaciones UI

- `name` requerido.
- `slug` requerido con autogeneracion editable.
- `sort_order >= 0`.
- `category_id` requerido para subcategorias.
- Bloqueo de doble submit durante guardado.
- Errores HTTP se muestran con mensajes legibles, incluyendo 400, 401, 403 y 409.
- Errores se limpian al cancelar o cambiar de accion.

## Comandos ejecutados

- `cd web && npx.cmd tsx --test modules/inventory/utils/product-classification.spec.ts lib/route-permissions.spec.ts lib/permissions.spec.ts`
  - Resultado: PASS, 19 tests.
- `cd web && npm.cmd run lint`
  - Resultado: PASS.
  - Nota: quedan warnings existentes fuera de esta fase.
- `cd web && npm.cmd run build`
  - Resultado: PASS.
- `openspec.cmd validate fortalecer-productos-inventario --type change --strict`
  - Resultado: PASS.
- `git diff --check`
  - Resultado: PASS.
  - Nota: PowerShell mostro warnings de CRLF en archivos OpenSpec.
- `Invoke-WebRequest -UseBasicParsing http://localhost:3029/default/inventory/product-categories`
  - Resultado: PASS, HTTP 200.
- `Invoke-WebRequest -UseBasicParsing http://localhost:3029/default/inventory/product-subcategories`
  - Resultado: PASS, HTTP 200.

## QA manual

- Estado: QA Manual PASS.
- Fase: 6.9.6 UI categorias/subcategorias sin modales.
- Rutas validadas:
  - `/00000000-0000-0000-0000-000000000001/inventory/product-categories`
  - `/00000000-0000-0000-0000-000000000001/inventory/product-subcategories`
- Confirmado:
  - Paginas cargan correctamente.
  - CRUD de categorias funciona.
  - CRUD de subcategorias funciona.
  - UX sin modales.
  - Foco a la accion.
  - Permisos equivalentes a Productos.
- Servidor local iniciado en `http://localhost:3029`.
- Smoke HTTP de rutas nuevas realizado: PASS.
- QA visual con sesion real realizado: PASS.
- Build confirma que las rutas nuevas compilan y se generan.
- Pruebas unitarias cubren helpers de validacion, slug e iniciales.
- Pruebas de permisos existentes confirman proteccion de rutas por `INVENTORY_PRODUCTS`.

## Pendientes explicitos

- Upload real.
- Storage local.
- Adaptacion del CRUD de productos.
- Filtros POS por categoria/subcategoria.
- Imagen efectiva en ProductCard POS.
- Cambios de impuestos.
- Cambios de descuentos.
- Cambios de inventario/stock.
- Cambios de cobro/pagos.
