# RBAC y menu dinamico

## Capas

- Roles declarados en `roles`
- Asignacion usuario-rol-tenant en `user_roles`
- Catalogo de menu en `menu_items`
- Permisos por rol en `role_menu_permissions`
- Guards backend: `RolesGuard` y `PermissionsGuard`
- Helpers frontend: `hasPermission()` y `hasMenuAccess()`

## Claves canonicas detectadas

- `DASHBOARD`
- `CONFIG_USUARIOS`
- `CONFIG_ROLES`
- `CONFIG_GENERAL`
- `CONFIG_MENU`

## Resolucion backend

`PermissionsGuard`:

- permite libre acceso si el endpoint no declara `@RequirePermission`
- deja pasar a `SUPER_ADMIN`
- deja pasar a `SUPER_USER` para ciertas claves de configuracion
- consulta `AccessControlService` para fusionar permisos del usuario por tenant

## Resolucion frontend

El layout por tenant:

- carga menu y permisos tras autenticar
- oculta rutas sin permiso
- redirige o deja la pantalla vacia hasta que permisos esten listos

## Observacion importante

No todos los endpoints de inventario usan `PermissionsGuard`; varios usan solo JWT + roles. En la UI si existen chequeos por acciones como `inventory.create` o `pos.create`. Esto crea una separacion entre seguridad UI y seguridad API que debe considerarse en roadmap.
