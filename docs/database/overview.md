# Base de datos

## Estrategia actual

- Motor: PostgreSQL
- Patron: base compartida, aislamiento logico por `tenant_id`
- Acceso: SQL manual desde servicios/repositorios

## Fuentes de verdad usadas para esta documentación

1. Runner y migraciones reproducibles en `scripts/database/`.
2. SQL histórico en `api/database/*.sql`.
3. Dump QA `database/manus_tienda_qa.sql` y dump histórico `api/database/dump-tenantcore-platform-202602211043.sql`.
4. Entidades, repositorios y consultas en `api/src/modules/**`.

## Mecanismo real de migración

El flujo versionado actual usa:

- `scripts/database/run_migrations.sh` para aplicar archivos `YYYYMMDD_*.sql` de `scripts/database/migrations/`.
- `scripts/database/migrate_prd.sh` para el flujo de producción con controles de fixtures y usuario runtime.
- `scripts/database/migrate.sh` para el flujo numerado base de `scripts/database/[0-9][0-9][0-9]_*.sql`.
- `public.migrations_history` para versión, checksum, resultado y fecha de aplicación.

La rama auditada contiene `scripts/database/migrations/V087__report_product_inventory.sql`.
La migración crea o reemplaza la función SQL `public.fnc_report_product_inventory`; no es una tabla nueva.

Importante: `V087__report_product_inventory.sql` no coincide con el patrón de ocho dígitos usado por `run_migrations.sh`.
La documentación del directorio de migraciones declara que `migrate_prd.sh` es la fuente para cambios nuevos `V###__description.sql`.
Por tanto, no se debe afirmar que ambos runners aplican el mismo conjunto efectivo.

El dump QA es evidencia de un estado de base de datos. No debe tratarse como migración reproducible.

## Esquema versionado de forma explícita

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

## Limitación y corrección de la auditoría inicial

La auditoría inicial miró principalmente `api/database/` y concluyó que el DDL operativo estaba incompleto.
La inspección ampliada demuestra que sí existe un pipeline adicional en `scripts/database/`, con migraciones V046–V093 y migraciones funcionales por fecha.

La conclusión correcta es más precisa:

- Existe un mecanismo reproducible de migraciones.
- El esquema está distribuido entre varias familias de SQL.
- `api/database/` no es la única fuente de DDL operativo.
- La equivalencia exacta entre todas las migraciones, el dump QA y cada ambiente desplegado aún requiere validación contra `migrations_history` de cada base.
