# Base de datos

## Estrategia actual

- Motor: PostgreSQL
- Patron: base compartida, aislamiento logico por `tenant_id`
- Acceso: SQL manual desde servicios/repositorios

## Fuentes de verdad usadas para esta documentacion

1. SQL versionado en `api/database/*.sql`
2. Dump `api/database/dump-tenantcore-platform-202602211043.sql`
3. Entidades y repositorios en `api/src/modules/**`

## Esquema versionado de forma explicita

- `tenants`
- `tenants_detalles`
- `tenant_branches`
- `roles`
- `personas`
- `users`
- `user_roles`
- `persona_tenant_branches`
- `permissions`
- `password_resets`
- `paises`
- `departamentos`
- `municipios`
- `menu_items`
- `role_menu_permissions`
- `security_audit_logs`
- `auditoria_eventos`
- `auth_refresh_tokens`
- `auth_sessions`

## Tablas operativas inferidas desde el backend

- `terminals`
- `pos_user_sessions`
- `products`
- `customers`
- `suppliers`
- `units`
- `taxes`
- `orders`
- `order_items`
- `purchases`
- `purchase_items`
- `sales`
- `sale_items`
- `sale_item_taxes`
- `sale_payment_methods`
- `stock_movements`

## Convencion real

- Claves UUID
- Fechas `created_at` y, en muchos casos, `updated_at`
- Desactivacion logica via `is_active` o `estado`
- Tenant scope por columna `tenant_id`
- Sucursal scope por `branch_id` cuando aplica

## Seeds detectados

- tenant inicial `default`
- rol `SUPER_ADMIN`
- usuario inicial en `initial_schema.sql`
- permisos legacy en tabla `permissions`
- catalogo `menu_items` y `role_menu_permissions` para dashboard/configuracion

## Limitacion importante

El repositorio no contiene el DDL completo y versionado para el dominio de inventario/POS. La aplicacion si depende de esas tablas en runtime.
