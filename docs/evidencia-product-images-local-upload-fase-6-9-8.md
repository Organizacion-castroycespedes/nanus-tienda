# Evidencia product images local upload - Fase 6.9.8

## Estado

Fase 6.9.8: Upload local de imagenes para productos/categorias/subcategorias.

Estado tecnico: PASS.
QA manual local: PASS.

## Discovery

- No existia modulo de upload/archivos en API.
- No existia carpeta o convencion previa de `storage/uploads`.
- `.gitignore` no ignoraba storage local.
- `api/.env.example` no tenia variables de uploads.
- API no servia archivos estaticos desde `main.ts`; se implemento retrieval por endpoint tenant-safe.
- `@nestjs/platform-express` ya estaba disponible para `multipart/form-data` con `FileInterceptor`.
- Productos/categorias/subcategorias ya tenian metadata `image_*` y `default_image_*`.
- Los endpoints existentes usan `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y permiso `INVENTORY_PRODUCTS`.
- La UI usa formularios inline/focus layout, sin modales como patron principal.

## Backend/API

Endpoints creados:

- `POST /api/inventory/products/:productId/image`
- `DELETE /api/inventory/products/:productId/image`
- `GET /api/inventory/products/:productId/image`
- `POST /api/inventory/product-categories/:categoryId/image`
- `DELETE /api/inventory/product-categories/:categoryId/image`
- `GET /api/inventory/product-categories/:categoryId/image`
- `POST /api/inventory/product-subcategories/:subcategoryId/image`
- `DELETE /api/inventory/product-subcategories/:subcategoryId/image`
- `GET /api/inventory/product-subcategories/:subcategoryId/image`

Servicio creado:

- `LocalImageStorageService`
- `ProductImageService`

Storage local:

- Base por defecto: `storage/uploads`.
- Configurable con `LOCAL_UPLOADS_DIR`.
- Storage keys:
  - `products/{tenant_id}/{product_id}/{uuid}.{ext}`
  - `product-categories/{tenant_id}/{category_id}/{uuid}.{ext}`
  - `product-subcategories/{tenant_id}/{subcategory_id}/{uuid}.{ext}`

Reglas:

- No se guardan blobs en DB.
- No se guardan rutas absolutas en DB.
- GET lee solo la storage key registrada en DB.
- Upload/delete validan tenant y permiso `INVENTORY_PRODUCTS`.
- Reemplazo guarda nuevo archivo, actualiza DB y borra anterior cuando es posible.
- Si falla update DB, se borra el archivo nuevo.

## Validaciones de archivo

Permitido:

- `image/jpeg`
- `image/png`
- `image/webp`

Rechazado:

- MIME no permitido.
- Extension no permitida.
- Firma/magic bytes invalida.
- Filename con path traversal.
- Archivo sin buffer.
- Tamano sobre limite.

Variables agregadas:

- `LOCAL_UPLOADS_DIR=../storage/uploads`
- `MAX_PRODUCT_IMAGE_SIZE_MB=5`
- `MAX_CATEGORY_IMAGE_SIZE_MB=5`

`.gitignore` actualizado:

- `storage/`
- `api/storage/`

## Frontend/UI

Componentes creados:

- `web/modules/inventory/components/InventoryImageUploadPanel.tsx`
- `web/modules/inventory/components/InventoryImagePreview.tsx`

Integrado en:

- `ProductForm`
- `ProductCategoryForm`
- `ProductSubcategoryForm`

Servicios extendidos:

- `uploadProductImage`
- `deleteProductImage`
- `uploadProductCategoryImage`
- `deleteProductCategoryImage`
- `uploadProductSubcategoryImage`
- `deleteProductSubcategoryImage`

UX:

- Imagen opcional.
- Sin modales.
- Si el registro no existe, muestra "Guarda primero..." y no bloquea el formulario.
- Preview autenticado via `apiBlobClient`; no depende de request CSS sin Bearer token.
- No se expone ruta fisica.
- Errores de upload/delete se muestran inline.

## Pruebas ejecutadas

PASS:

```powershell
cd api
npx.cmd tsx --test src/modules/inventory/services/local-image-storage.service.spec.ts src/modules/inventory/services/product-image.service.spec.ts src/modules/inventory/controllers/operational-role-permissions.controller.spec.ts
```

Resultado: 15 tests PASS.

PASS:

```powershell
cd api
npm.cmd run build
```

PASS:

```powershell
cd web
npx.cmd tsx --test modules/inventory/utils/product-classification.spec.ts modules/inventory/utils/inventory-image-upload.spec.ts
```

Resultado: 11 tests PASS.

PASS con warnings existentes:

```powershell
cd web
npm.cmd run lint
```

PASS con warnings existentes:

```powershell
cd web
npm.cmd run build
```

PASS:

```powershell
openspec.cmd validate fortalecer-productos-inventario --type change --strict
```

Resultado: `Change 'fortalecer-productos-inventario' is valid`.

PASS con warnings de CRLF del working copy:

```powershell
git diff --check
```

## QA manual

PASS.

Rutas validadas:

- `/00000000-0000-0000-0000-000000000001/inventory/product-categories`
- `/00000000-0000-0000-0000-000000000001/inventory/product-subcategories`
- `/00000000-0000-0000-0000-000000000001/inventory/products`

Confirmado:

- Categorias: subir, previsualizar, reemplazar y eliminar imagen funciona.
- Subcategorias: subir, previsualizar, reemplazar y eliminar imagen funciona.
- Productos: subir, previsualizar, reemplazar y eliminar imagen funciona.
- Archivos invalidos son rechazados con mensaje legible.
- Preview autenticado funciona.
- No se expone ruta fisica del servidor.
- Registro sin imagen sigue funcionando.
- Permisos equivalentes a Productos se mantienen.
- No se implementaron POS filtros.
- No se implemento imagen efectiva POS.
- No se tocaron impuestos, descuentos, inventario/stock ni cobro/pagos.

## Pendientes / fuera de alcance

- Filtros POS.
- Imagen efectiva POS.
- Thumbnails/procesamiento avanzado.
- Impuestos.
- Descuentos.
- Inventario/stock.
- Cobro/pagos.
- Nuevas migraciones DB.
