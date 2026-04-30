# Modulo branches

## Proposito

Administra sucursales por tenant.

## Endpoints

- `GET /api/branches`
- `GET /api/branches/:id`
- `POST /api/branches`
- `PUT /api/branches/:id`
- `PATCH /api/branches/:id/status`

## Reglas

- siempre debe existir una sucursal principal
- si se crea la primera, queda principal automaticamente
- `SUPER_ADMIN` y `SUPER_USER` pueden cruzar tenant

## UI

- gestion integrada en `/{tenant}/configuracion`
