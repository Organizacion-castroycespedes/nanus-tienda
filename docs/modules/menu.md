# Modulo menu

## Proposito

Construye el menu visible del usuario y administra catalogo de menu/permisos por rol.

## Endpoints

- `GET /api/me/menu`
- `GET /api/me/permissions`
- endpoints `admin/*` para gestion de menu

## Tablas clave

- `menu_items`
- `role_menu_permissions`

## Reglas

- el menu se arma desde los permisos efectivos del rol
- padres se agregan aunque el permiso directo este en un hijo
- `SUPER_ADMIN` administra catalogo completo
