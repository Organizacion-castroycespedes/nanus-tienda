# Delta spec: productos

## ADDED Requirements

### Requirement: Producto enriquecido

El sistema SHALL extender el producto actual para manejar atributos operativos sin romper productos existentes.

#### Scenario: Producto existente sigue valido

- GIVEN un producto creado con el modelo actual
- WHEN se consulta o se vende
- THEN el sistema SHALL conservar compatibilidad con los campos actuales
- AND los nuevos atributos SHALL ser opcionales o tener defaults seguros.

#### Scenario: Producto nuevo con atributos operativos

- GIVEN un usuario con permiso de escritura en productos
- WHEN crea o edita un producto
- THEN SHALL poder definir si es perecedero, si exige lote, si exige vencimiento, su estado operativo y clasificacion.

### Requirement: Producto perecedero o no perecedero

El sistema SHALL distinguir productos perecederos y no perecederos.

#### Scenario: Perecedero requiere reglas de vencimiento

- GIVEN un producto marcado como perecedero
- WHEN ingresa inventario
- THEN el sistema SHALL aplicar reglas de vencimiento segun configuracion.

#### Scenario: No perecedero conserva flujo actual

- GIVEN un producto no perecedero
- WHEN ingresa o sale inventario
- THEN el sistema SHALL permitir operar sin vencimiento.

### Requirement: Lote obligatorio por producto

El sistema SHALL permitir exigir lote por producto.

#### Scenario: Recepcion sin lote rechazada

- GIVEN un producto con lote obligatorio
- WHEN se recibe una compra sin lote
- THEN el sistema SHALL rechazar la recepcion.

#### Scenario: Producto sin lote obligatorio

- GIVEN un producto sin lote obligatorio
- WHEN se opera compra o venta
- THEN el sistema SHALL mantener el comportamiento actual.

### Requirement: Vencimiento obligatorio por producto

El sistema SHALL permitir exigir fecha de vencimiento por producto.

#### Scenario: Lote sin vencimiento rechazado

- GIVEN un producto con vencimiento obligatorio
- WHEN se registra lote sin fecha de vencimiento
- THEN el sistema SHALL rechazar la operacion.

### Requirement: Codigos de barras multiples

El sistema SHALL soportar multiples codigos de barras por producto sin reemplazar `sku`.

#### Scenario: Busqueda por barcode

- GIVEN un producto con barcode
- WHEN el usuario escanea o busca el barcode
- THEN el sistema SHALL resolver el producto dentro del tenant autorizado.

#### Scenario: Barcode unico por tenant

- GIVEN dos productos del mismo tenant
- WHEN se intenta asignar el mismo barcode activo a ambos
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Barcode repetido en tenant diferente

- GIVEN dos tenants distintos
- WHEN ambos usan el mismo barcode
- THEN el sistema MAY permitirlo porque la unicidad es por tenant.

#### Scenario: Barcode principal

- GIVEN un producto con varios barcodes activos
- WHEN se marca uno como principal
- THEN el sistema SHALL garantizar solo un barcode principal activo por producto.

SUPUESTO: El formato especifico de `EAN13`, `EAN8`, `UPC`, `QR`, `INTERNAL` u `OTHER` se validara en `api/`; la base de datos garantizara unicidad y no vacio.

### Requirement: Defaults legacy de producto

El sistema SHALL migrar productos existentes con defaults seguros.

#### Scenario: Producto actual migrado

- GIVEN un producto existente antes de Fase 3
- WHEN se apliquen migraciones futuras
- THEN el producto SHALL quedar con `is_perishable = false`, `requires_lot = false`, `requires_expiration = false` y `operational_status = ACTIVE`.

#### Scenario: Vencimiento exige lote

- GIVEN un producto con `requires_expiration = true`
- WHEN se guarda la configuracion
- THEN el sistema SHALL exigir tambien `requires_lot = true`.

### Requirement: Estado y clasificacion operativa

El sistema SHALL permitir estados y clasificaciones operativas mas ricas que `is_active`.

#### Scenario: Producto bloqueado para POS

- GIVEN un producto con estado no vendible
- WHEN POS carga catalogo
- THEN el producto SHALL no estar disponible para venta.

#### Scenario: Clasificacion visible

- GIVEN un producto clasificado
- WHEN se lista en inventario o reporteria
- THEN el sistema SHALL mostrar su clasificacion.

RIESGO: Nuevos estados mal definidos pueden bloquear ventas o compras legitimas.

### Requirement: Product classification menu access

The system SHALL expose product categories and subcategories through the application menu only to roles with product-equivalent permissions.

#### Scenario: Role has product access

- GIVEN a role has access to Products
- WHEN the user opens the application menu
- THEN the user SHALL be able to access product categories and subcategories according to the selected navigation design.

#### Scenario: Role lacks product access

- GIVEN a role does not have access to Products
- WHEN the user opens the application menu
- THEN the user SHALL NOT see product categories or subcategories.

### Requirement: Product-equivalent classification permissions

The system SHALL protect product categories and subcategories with the same permission model used by Products.

#### Scenario: Direct URL access without product permission

- GIVEN a user does not have product permission
- WHEN the user navigates directly to the product categories or subcategories route
- THEN access SHALL be denied according to the current authorization pattern.

#### Scenario: API request without product permission

- GIVEN a user does not have product permission
- WHEN the user calls a product category or subcategory endpoint
- THEN the API SHALL reject the request.

### Requirement: Idempotent menu and permission seed

The system SHALL provide an idempotent database script for product classification menu and permissions.

#### Scenario: Permission script executed twice

- GIVEN the product classification menu/permission script was already applied
- WHEN it is executed again
- THEN it SHALL NOT create duplicate menu items
- AND it SHALL NOT create duplicate role-menu permission rows
- AND it SHALL preserve existing product permissions.

### Requirement: Product classification persistence

The system SHALL persist product categories and subcategories in tenant-scoped tables prepared for default image metadata without implementing file upload.

#### Scenario: Category stored per tenant

- GIVEN a user creates a product category
- WHEN the category is saved
- THEN the system SHALL persist it with `tenant_id`, `name`, `slug`, `is_active`, `sort_order`, timestamps and optional default image metadata.
- AND the category `slug` SHALL be unique only inside the tenant.

#### Scenario: Subcategory stored per tenant and category

- GIVEN a user creates a product subcategory
- WHEN the subcategory is saved
- THEN the system SHALL persist it with `tenant_id`, `category_id`, `name`, `slug`, `is_active`, `sort_order`, timestamps and optional default image metadata.
- AND the subcategory `slug` SHALL be unique only inside the same tenant and category.

### Requirement: Tenant-safe classification backend

The system SHALL expose backend endpoints for product categories and subcategories that validate tenant ownership on every operation.

#### Scenario: Cross-tenant category update

- GIVEN a category belongs to another tenant
- WHEN a user attempts to update it through the category API
- THEN the system SHALL reject the operation as not found or invalid according to the current backend pattern.

#### Scenario: Subcategory uses category from another tenant

- GIVEN a category belongs to another tenant
- WHEN a user attempts to create or update a subcategory using that category
- THEN the API SHALL reject the request.

### Requirement: Product classification assignment

The system SHALL allow products to reference an optional category and optional subcategory while preserving products without classification.

#### Scenario: Product without classification

- GIVEN a product has no category or subcategory
- WHEN it is created, updated or listed
- THEN it SHALL continue working with compatible null classification fields.

#### Scenario: Product with valid category and subcategory

- GIVEN a category and subcategory belong to the same tenant
- AND the subcategory belongs to the category
- WHEN a product is created or updated with those identifiers
- THEN the system SHALL persist the classification.

#### Scenario: Subcategory without category

- GIVEN a product payload includes `subcategory_id` without `category_id`
- WHEN the API validates the payload
- THEN it SHALL reject the request.

#### Scenario: Subcategory does not belong to category

- GIVEN a subcategory belongs to a different category
- WHEN a product payload pairs it with the wrong category
- THEN the API SHALL reject the request.

### Requirement: Product image metadata without upload

The system SHALL store optional product image metadata fields without implementing actual file upload or local storage in this phase.

#### Scenario: Product image metadata provided

- GIVEN a product payload includes image URL, storage key, alt text, MIME type or size
- WHEN the API validates and saves the product
- THEN it SHALL allow only `image/jpeg`, `image/png` or `image/webp` MIME types.
- AND it SHALL reject negative image sizes.
- AND it SHALL update `image_updated_at` when image metadata changes.

### Requirement: Product classification administration UI

The system SHALL provide frontend pages to administer product categories and subcategories without using modals as the primary create/edit pattern.

#### Scenario: Manage categories from focused UI

- GIVEN a user has product-equivalent permission
- WHEN the user opens `/inventory/product-categories`
- THEN the system SHALL list product categories for the current tenant.
- AND the user SHALL be able to create, edit, activate and deactivate categories through a focused inline or master-detail experience.
- AND the page SHALL show active/inactive state, description, sort order and image placeholder or image URL preview.

#### Scenario: Manage subcategories from focused UI

- GIVEN a user has product-equivalent permission
- WHEN the user opens `/inventory/product-subcategories`
- THEN the system SHALL list product subcategories for the current tenant.
- AND the user SHALL be able to filter by parent category.
- AND the user SHALL be able to create, edit, activate and deactivate subcategories through a focused inline or master-detail experience.
- AND creating a subcategory SHALL require selecting a parent category.

#### Scenario: No categories exist for subcategories

- GIVEN no product categories exist for the current tenant
- WHEN the user opens the subcategory administration page
- THEN the system SHALL guide the user to create categories before creating subcategories.

#### Scenario: Classification UI preserves out-of-scope features

- GIVEN the classification UI is available
- WHEN the user administers categories or subcategories
- THEN the system SHALL NOT implement real image upload, local storage, POS category filters or POS product image changes in this phase.

### Requirement: Product CRUD classification assignment UI

The system SHALL allow product create and edit workflows to assign optional product categories and subcategories.

#### Scenario: Create product without classification

- GIVEN a user has product write permission
- WHEN the user creates a product without selecting category or subcategory
- THEN the product SHALL be saved without classification.
- AND existing price, tax, unit, stock and operational fields SHALL keep their current behavior.

#### Scenario: Create product with category and subcategory

- GIVEN categories and subcategories exist for the current tenant
- WHEN the user creates a product with a category and one of its subcategories
- THEN the frontend SHALL send both `categoryId` and `subcategoryId`.
- AND the product SHALL be saved with that classification.

#### Scenario: Dependent subcategory selection

- GIVEN a category is selected in the product form
- WHEN the user opens the subcategory selector
- THEN only subcategories belonging to the selected category SHALL be available.
- AND changing or clearing the category SHALL clear any subcategory that no longer belongs.

#### Scenario: Product list shows classification compactly

- GIVEN products are listed in inventory
- WHEN a product has category or subcategory values
- THEN the list SHALL show the category and subcategory compactly.
- AND products without category SHALL show a clear fallback.

#### Scenario: Product CRUD classification preserves out-of-scope features

- GIVEN product CRUD supports classification assignment
- WHEN the user creates or edits products
- THEN the system SHALL NOT implement real image upload, local storage, POS filters, POS effective image, taxes, discounts, inventory/stock changes or payments changes in this phase.
