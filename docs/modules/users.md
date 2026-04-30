# Modulo users

## Proposito

Administra usuarios del tenant, persona asociada, rol principal y sucursal principal.

## Endpoints

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/password`

## Permisos

- roles base: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`
- permiso requerido: `CONFIG_USUARIOS`

## Reglas

- email unico por tenant
- password minima de 8 caracteres
- rol requerido
- sucursal requerida
- `ADMIN` no debe ver ni manipular `SUPER_ADMIN`

## UI

- wizard de varios pasos en `/{tenant}/usuarios`
- filtros por texto y estado
