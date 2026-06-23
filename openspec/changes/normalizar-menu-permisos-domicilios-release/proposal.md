# Propuesta: normalizar-menu-permisos-domicilios-release

## Objetivo

Crear la migración formal `V070__deliveries_menu_permissions_seed.sql` para asegurar la base de datos QA/AWS con menú y permisos base de `Domicilios` sin depender de scripts locales no versionados.

## Alcance

- Crear/actualizar `menu_items.key = DELIVERIES` para todos los tenants:
  - `label = 'Domicilios'`
  - `route = '/{tenant}/deliveries'`
  - `module = 'deliveries'`
  - `icon = 'Truck'`
  - `sort_order = 240`
  - `visible = TRUE`
- Crear/actualizar permisos de `role_menu_permissions` para:
  - `USER`
  - `ADMIN`
  - `SUPER_USER`
  - `SUPER_ADMIN`
- Mantener idempotencia y no realizar borrados.
