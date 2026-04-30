# RBAC real del proyecto

## Roles detectados

- `SUPER_ADMIN`
- `SUPER_USER`
- `ADMIN`
- `USER`

## Comportamiento observado

### `SUPER_ADMIN`

- bypass de `PermissionsGuard`
- puede listar/crear/editar tenants
- puede administrar menu
- puede cruzar tenants en multiples modulos

### `SUPER_USER`

- acceso ampliado de configuracion en backend para ciertas claves
- gestion de sucursales y terminales
- en frontend suele tratarse como rol super para filtros de inventario

### `ADMIN`

- gestion de usuarios del tenant
- consumo de configuracion y roles segun permisos
- acceso a inventario/operacion segun roles de controller y permisos UI

### `USER`

- acceso operativo limitado
- lectura de productos
- uso de menu/permisos asignados

## Aislamiento

### Tenant

- base compartida con `tenant_id`
- backend valida tenant segun actor autenticado

### Sucursal

- validaciones en branches/terminals/POS
- inventario y operaciones pueden filtrar por `branch_id`

### Terminal

- validada antes de abrir sesion POS
- incluida en movimientos de stock y flujo POS

## Permisos frontend/backend

- Backend:
  - usa `RolesGuard` y en algunos modulos `PermissionsGuard`
- Frontend:
  - usa `hasPermission()` y `hasMenuAccess()`
  - protege rutas desde `route-permissions.ts`

## Nota de consistencia

Los permisos por acciones (`inventory.create`, `pos.create`, etc.) aparecen mas desarrollados en frontend que en guards backend para algunos modulos operativos.
