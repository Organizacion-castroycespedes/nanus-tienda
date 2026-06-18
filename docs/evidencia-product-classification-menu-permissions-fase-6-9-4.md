# Evidencia: permisos y menu de clasificacion de productos

Fecha: 2026-06-17

## Discovery

Menu actual de Productos:

- Tabla principal: `menu_items`.
- Key actual: `INVENTORY_PRODUCTS`.
- Ruta actual: `/{tenant}/inventory/products`.
- Padre esperado: `INVENTORY`.
- Script base observado: `scripts/database/products/2026_04_25_seed_menu_inventory_children.sql`.
- Script operativo mas reciente observado: `scripts/database/013_operational_menu_inventory_locations_lots_terminals.sql`.

Permisos actuales:

- Tabla activa: `role_menu_permissions`.
- Indice idempotente: `role_menu_permissions_unique` sobre `(tenant_id, role_id, menu_item_id)`.
- Acceso simple: `access_level` con `READ` o `WRITE`.
- Acciones: columna `actions` en `jsonb`.
- Tabla legacy `permissions` existe, pero el flujo de menu/guards usa `menu_items` + `role_menu_permissions`.
- No se encontro tabla `role_permissions` activa en el esquema actual.

Permisos de Productos en backend:

- Ver productos: `@RequirePermission({ menuKey: "INVENTORY_PRODUCTS", level: "READ" })`.
- Crear productos: `INVENTORY_PRODUCTS` con `WRITE`.
- Editar productos: `INVENTORY_PRODUCTS` con `WRITE`.
- Cambiar precio: `INVENTORY_PRODUCTS` con `WRITE`.
- Eliminar logicamente: `INVENTORY_PRODUCTS` con `WRITE`.
- Codigos de barras: lectura con `READ`, crear/editar/desactivar/primario con `WRITE`.
- Activar/desactivar producto no tiene endpoint separado; se maneja por edicion o eliminacion logica.
- Importar/exportar productos no se encontro implementado.

Guards actuales de Productos:

- Backend: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`.
- Roles escritura: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`.
- Lectura: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER` con `operationalRoles` en endpoints de catalogo.
- Tenant: el backend resuelve `tenantId` desde `request.user.tenantId`; no confia en tenant manual para Productos.
- Sucursal: `ProductController.list` valida `branchId` con `AccessControlService.canAccessBranch`.

Frontend:

- Menu visible se filtra con `getAllowedMenuItems` y `hasMenuAccess`.
- Acceso directo por URL se resuelve en `web/lib/route-permissions.ts` y `web/app/[tenant]/layout.tsx`.
- Productos usa ruta protegida por `INVENTORY_PRODUCTS`.
- Acciones en la vista de productos usan checks operativos `inventory.create`, `inventory.update` e `inventory.delete`.

Roles operativos encontrados:

- `SUPER_ADMIN`
- `SUPER_USER`
- `ADMIN`
- `USER`

## Decision

Categorias y subcategorias usan claves de menu separadas para navegacion:

- `INVENTORY_PRODUCT_CATEGORIES`
- `INVENTORY_PRODUCT_SUBCATEGORIES`

La autorizacion queda equivalente a Productos:

- El SQL copia `access_level` y `actions` desde el permiso real de `INVENTORY_PRODUCTS`.
- La proteccion frontend por URL exige `INVENTORY_PRODUCTS`.
- Las futuras APIs de categorias/subcategorias deben usar `MENU_KEYS.INVENTORY_PRODUCTS` o un guard equivalente que requiera permiso de Productos.

No se agregaron endpoints backend de categorias/subcategorias porque no existen controladores, servicios, repositorios ni tablas de categorias/subcategorias en el repo actual.

## SQL

Archivo creado:

- `scripts/database/migrations/20260617_product_classification_menu_permissions.sql`

El script:

- Inserta o actualiza menu items de categorias y subcategorias por tenant.
- Los ubica bajo `INVENTORY` cuando el padre existe.
- Copia permisos desde `INVENTORY_PRODUCTS`.
- No borra permisos existentes.
- Valida no duplicados por key/ruta.
- Valida no duplicados en `role_menu_permissions`.
- Valida que todo rol con Productos tenga clasificacion equivalente.
- Valida que no existan permisos de clasificacion para roles sin Productos.

## QA local

Se ejecuto la migracion dos veces contra la DB configurada en `scripts/config/db.env`.
El comando aborto automaticamente si `ENVIRONMENT` no era local/dev/qa/test/staging.

Resultados:

```text
classificationMenuItems=2
duplicateMenuItems=0
duplicateRoleMenuPermissions=0
rolesWithProductMissingClassification=0
rolesWithoutProductWithClassification=0
```

Pendiente:

- Aplicar guard backend cuando existan endpoints reales de categorias/subcategorias.
- Validar visualmente `/auth/menu` con credenciales aprobadas por rol.
