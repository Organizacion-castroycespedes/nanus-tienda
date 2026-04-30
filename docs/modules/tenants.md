# Modulo tenants

## Proposito

Gestiona tenant, branding y detalles empresariales.

## Endpoints

- `GET /api/tenants`
- `POST /api/tenants`
- `PUT /api/tenants/:id`
- `GET/PUT /api/tenants/:id/config`
- `GET/PUT/DELETE /api/tenants/:id/details`

## Permisos

- `SUPER_ADMIN` y `SUPER_USER` para listado
- `CONFIG_GENERAL` para actualizar config/detalles

## UI

- pagina `/{tenant}/configuracion`
- tabs de empresa, branding y sucursales

## Reglas

- branding vive en `tenants.config`
- detalles empresariales viven en `tenants_detalles`
