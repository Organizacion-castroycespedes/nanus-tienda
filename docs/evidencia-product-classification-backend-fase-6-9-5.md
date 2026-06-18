# Evidencia fase 6.9.5: DB + backend categorias/subcategorias tenant-safe

Fecha: 2026-06-17

Change OpenSpec: `fortalecer-productos-inventario`

## Alcance ejecutado

- Se implemento base de datos y backend real para categorias y subcategorias de productos.
- Se mantuvo el permiso equivalente a Productos: `INVENTORY_PRODUCTS`.
- Se mantuvo alcance tenant-safe en queries, services y constraints.
- Se agrego preparacion para metadata de imagen sin implementar upload ni storage local.

## Discovery breve

- Migraciones reales viven en `scripts/database/migrations/`.
- La convencion vigente acepta `YYYYMMDD_*.sql` y `V###__*.sql`; el runner registra checksum en `migrations_history`.
- La idempotencia SQL usa `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y `DO $$` para constraints/FKs.
- Productos usan `ProductController` -> `ProductService` -> `ProductRepository` con SQL directo via `DatabaseService`.
- Productos usan `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y `RequirePermission` con `INVENTORY_PRODUCTS`.
- El tenant se resuelve desde `request.user.tenantId` y, en patrones nuevos, tambien `request.context?.tenantId`.
- UUIDs se validan en controllers con regex y errores `BadRequestException`.
- 404 usa `NotFoundException`; duplicados y referencias invalidas usan `BadRequestException`.
- `updated_at` se actualiza en repositories con `updated_at = NOW()`.

## Migracion creada

Archivo:

- `scripts/database/migrations/V062__product_classification_backend_phase_6_9_5.sql`

Tablas creadas:

- `product_categories`
- `product_subcategories`

Columnas agregadas a `products`:

- `category_id`
- `subcategory_id`
- `image_url`
- `image_storage_key`
- `image_alt_text`
- `image_mime_type`
- `image_size_bytes`
- `image_updated_at`

Constraints e indices agregados:

- FKs tenant-aware para categoria y subcategoria.
- Unicidad de categoria por `(tenant_id, slug)`.
- Unicidad de subcategoria por `(tenant_id, category_id, slug)`.
- Checks de MIME `image/jpeg`, `image/png`, `image/webp`.
- Checks de tamanos no negativos y `sort_order >= 0`.
- Check `subcategory_id IS NULL OR category_id IS NOT NULL`.
- Indices solicitados para categorias, subcategorias y productos.

## Endpoints creados

Categorias:

- `GET /api/inventory/product-categories`
- `GET /api/inventory/product-categories/:categoryId`
- `POST /api/inventory/product-categories`
- `PUT /api/inventory/product-categories/:categoryId`
- `PATCH /api/inventory/product-categories/:categoryId/activate`
- `PATCH /api/inventory/product-categories/:categoryId/deactivate`

Subcategorias:

- `GET /api/inventory/product-subcategories`
- `GET /api/inventory/product-subcategories/:subcategoryId`
- `POST /api/inventory/product-subcategories`
- `PUT /api/inventory/product-subcategories/:subcategoryId`
- `PATCH /api/inventory/product-subcategories/:subcategoryId/activate`
- `PATCH /api/inventory/product-subcategories/:subcategoryId/deactivate`

## Validaciones tenant-safe

- Todas las consultas de categorias filtran por `tenant_id`.
- Todas las consultas de subcategorias filtran por `tenant_id`.
- Crear subcategoria valida que `categoryId` pertenezca al tenant.
- Actualizar subcategoria valida que la nueva categoria pertenezca al tenant.
- Crear/actualizar producto valida que `categoryId` pertenezca al tenant.
- Crear/actualizar producto valida que `subcategoryId` pertenezca al tenant.
- Crear/actualizar producto valida que la subcategoria pertenezca a la categoria enviada.
- Producto con `subcategoryId` sin `categoryId` se rechaza.
- Cambio de categoria con subcategoria existente se rechaza si no se envia una subcategoria compatible.

## Permisos

- Los endpoints nuevos usan:
  - `JwtAuthGuard`
  - `RolesGuard`
  - `PermissionsGuard`
  - `RequirePermission({ menuKey: MENU_KEYS.INVENTORY_PRODUCTS, level: "READ" | "WRITE" })`
- Las escrituras quedan restringidas a `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`.
- Las lecturas siguen el patron actual de Productos para catalogo operativo.

## Comandos y resultados

SQL idempotencia local/dev x2:

```powershell
psql -v ON_ERROR_STOP=1 -f scripts/database/migrations/V062__product_classification_backend_phase_6_9_5.sql
psql -v ON_ERROR_STOP=1 -f scripts/database/migrations/V062__product_classification_backend_phase_6_9_5.sql
```

Resultado: PASS. Segunda ejecucion no creo duplicados; PostgreSQL reporto objetos ya existentes y omitidos.

Validacion DB:

- `product_categories`: 14 columnas.
- `product_subcategories`: 15 columnas.
- `products`: 8 columnas nuevas presentes.
- Duplicados de constraints esperados: `0`.
- Indices esperados presentes: `6`.

Tests backend:

```powershell
npx.cmd tsx --test src/modules/inventory/services/product-category.service.spec.ts src/modules/inventory/services/product-subcategory.service.spec.ts src/modules/inventory/services/product.service.spec.ts src/modules/inventory/controllers/operational-role-permissions.controller.spec.ts src/common/guards/permissions.guard.spec.ts
```

Resultado: PASS. `83` tests pass, `0` fail.

Build API:

```powershell
npm.cmd run build
```

Resultado: PASS.

OpenSpec:

```powershell
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: PASS. `items: 1`, `passed: 1`, `failed: 0`.

Whitespace:

```powershell
git diff --check
```

Resultado: PASS. Solo warnings de CRLF esperados por Git en Windows.

## Fuera de alcance confirmado

- No UI frontend de categorias/subcategorias.
- No UI producto.
- No upload real de imagenes.
- No storage local.
- No filtros POS.
- No cambios de impuestos.
- No cambios de descuentos.
- No cambios de inventario/stock/FEFO.
- No cambios de cobro, caja ni pagos.
