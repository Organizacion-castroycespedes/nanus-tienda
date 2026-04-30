# Modulo terminals

## Proposito

Administra terminales POS por sucursal.

## Endpoints

- `GET /api/terminals`
- `POST /api/terminals`
- `PATCH /api/terminals/:id`
- `PATCH /api/terminals/:id/status`

## Reglas

- codigo unico por sucursal
- la sucursal debe pertenecer al tenant
- terminal inactiva no puede iniciar sesion POS

## UI

- pagina `/{tenant}/config/terminals`
- acceso agregado como shortcut desde configuracion para roles super
