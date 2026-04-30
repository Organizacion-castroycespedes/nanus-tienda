# Modulo roles

## Proposito

Gestiona catalogo de roles y su asociacion con tenants desde la perspectiva del usuario actual.

## Endpoints

- `GET /api/roles`
- `POST /api/roles`
- `PUT /api/roles/:id`

## Permisos

- lectura: `CONFIG_ROLES`
- escritura: `CONFIG_ROLES`
- creacion/edicion real restringida a `SUPER_ADMIN`

## UI

- pagina `/{tenant}/roles`
- modal crear/editar
- seleccion multi-tenant solo para `SUPER_ADMIN`
