# Diseño: normalizar-menu-permisos-domicilios-release

## Implementación

- Migration SQL idempotente en:
  - `scripts/database/migrations/V070__deliveries_menu_permissions_seed.sql`
- Flujo SQL:
  1. `INSERT ... ON CONFLICT (tenant_id, key) ... DO UPDATE` para `menu_items` y `visible = TRUE`.
  2. `INSERT ... ON CONFLICT (tenant_id, role_id, menu_item_id) ... DO UPDATE` para `role_menu_permissions`.
- Sin operación destructiva:
  - no `DELETE` sobre `menu_items`.
  - no `DELETE` sobre `role_menu_permissions`.
  - no `DELETE` sobre `roles`.
- Sin tocar módulos distintos a `DELIVERIES`.

## Evidencia

- Crear archivo:
  - `docs/evidencia-qa-migracion-v070-domicilios-menu-permisos.md`
