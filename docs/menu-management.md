# Menu Management (Creación de Menú)

## Resumen
Esta implementación separa el catálogo de rutas (menú) de la asignación de permisos por rol, manteniendo `tenant_id` en ambos para reforzar el aislamiento multi-tenant. El módulo es administrable **solo por SUPER_ADMIN** y registra auditoría de cambios.

## Decisiones clave
- **Catálogo por tenant:** cada tenant puede personalizar su menú (`menu_items.tenant_id` es obligatorio).
- **Permisos por rol:** `role_menu_permissions` define el nivel de acceso (`READ` o `WRITE`) y soporta acciones granulares vía `actions` (JSONB).
- **Backend-first enforcement:** los endpoints aplican `PermissionsGuard` (READ para GET, WRITE para mutaciones) y el frontend solo oculta UI.

## Esquema de tablas
```
menu_items
  id (uuid, pk)
  tenant_id (uuid, fk tenants)
  key (text)
  module (text)
  label (text)
  route (text)
  icon (text)
  parent_id (uuid, fk menu_items)
  sort_order (int)
  visible (bool)
  below_main_menu (bool)
  metadata (jsonb)
  created_at / updated_at / deleted_at

role_menu_permissions
  id (uuid, pk)
  tenant_id (uuid, fk tenants)
  role_id (uuid, fk roles)
  menu_item_id (uuid, fk menu_items)
  access_level (READ | WRITE)
  actions (jsonb)
  created_at

security_audit_logs
  id (uuid, pk)
  actor_user_id (uuid)
  tenant_id (uuid)
  action (text)
  entity (text)
  entity_id (uuid)
  before (jsonb)
  after (jsonb)
  ip (text)
  user_agent (text)
  created_at
```

## Migración
Archivo idempotente: `api/database/2025_03_07_menu_management.sql`.

Incluye:
- Creación de `menu_items`, `role_menu_permissions`, `security_audit_logs`.
- Backfill desde `permissions` existente.
- Seeds para keys base (`CONFIG_USUARIOS`, `CONFIG_ROLES`, `CONFIG_GENERAL`, `CONFIG_MENU`).

## Seeds adicionales
Archivo idempotente: `api/database/2025_03_20_seed_admin_config_permissions.sql`.

Incluye:
- Permisos `WRITE` para el rol **ADMIN** sobre `CONFIG_GENERAL`.

## Endpoints principales
### Admin (solo SUPER_ADMIN)
- `POST /api/admin/menu-items`
- `GET /api/admin/menu-items?tenantId=...`
- `PATCH /api/admin/menu-items/:id`
- `PATCH /api/admin/menu-items/:id/status`
- `DELETE /api/admin/menu-items/:id`
- `GET /api/admin/roles/:roleId/menu-permissions?tenantId=...`
- `PUT /api/admin/roles/:roleId/menu-permissions`

### Consumo del usuario
- `GET /api/me/menu`
- `GET /api/me/permissions`

### Configuración general (permiso CONFIG_GENERAL)
- `GET /api/tenants/:id/config`
- `PUT /api/tenants/:id/config`
- `GET /api/tenants/:id/details`
- `PUT /api/tenants/:id/details`
- `DELETE /api/tenants/:id/details`
- `GET /api/locations/paises`
- `GET /api/locations/departamentos`
- `GET /api/locations/municipios`

## Ejemplos de payloads
### Crear menú
```json
{
  "tenantId": "...",
  "key": "CONFIG_USUARIOS",
  "module": "configuracion",
  "label": "Usuarios",
  "route": "/{tenant}/usuarios",
  "icon": "User",
  "parentId": null,
  "sortOrder": 10,
  "visible": true,
  "belowMainMenu": false,
  "metadata": {}
}
```

### Reemplazar permisos por rol
```json
{
  "tenantId": "...",
  "permissions": [
    { "menuItemId": "...", "accessLevel": "READ" },
    { "menuItemId": "...", "accessLevel": "WRITE" }
  ]
}
```

## Notas de seguridad
- **SUPER_ADMIN** requerido en `/api/admin/**`.
- `PermissionsGuard` valida READ/WRITE en endpoints protegidos.
- La UI no sustituye el control server-side.
- Auditoría en cambios críticos de menú y permisos.
- Tenants listado/creación/actualización global protegidos por rol **SUPER_ADMIN**.
