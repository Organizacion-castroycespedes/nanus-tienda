# Modelo logico textual

## Núcleo multi-tenant

- `tenants` 1---1 `tenants_detalles`
- `tenants` 1---N `tenant_branches`
- `tenants` 1---N `users`
- `tenants` 1---N `personas`
- `users` N---N `roles` via `user_roles`
- `personas` N---N `tenant_branches` via `persona_tenant_branches`

## Seguridad

- `roles` 1---N `role_menu_permissions`
- `menu_items` 1---N `role_menu_permissions`
- `users` 1---N `auth_sessions`
- `users` 1---N `auth_refresh_tokens`
- `auth_sessions` 1---N `pos_user_sessions`

## POS y operacion

- `tenant_branches` 1---N `terminals`
- `customers` 1---N `orders`
- `customers` 1---N `sales`
- `suppliers` 1---N `purchases`
- `products` N---1 `units`
- `products` N---0..1 `taxes`
- `orders` 1---N `order_items`
- `purchases` 1---N `purchase_items`
- `sales` 1---N `sale_items`
- `sale_items` 1---N `sale_item_taxes`
- `sales` 1---N `sale_payment_methods`
- `products` 1---N `stock_movements`

## Columnas inferidas clave

### `products`

- `id`, `tenant_id`, `unit_id`, `tax_id`
- `name`, `description`, `sku`
- `price`, `cost`, `price_with_tax`, `price_without_tax`
- `is_active`, `created_at`, `updated_at`

### `terminals`

- `id`, `tenant_id`, `branch_id`
- `name`, `code`, `device_fingerprint`
- `is_active`, `created_at`

### `pos_user_sessions`

- `id`, `auth_session_id`, `user_id`, `tenant_id`
- `branch_id`, `terminal_id`
- `started_at`, `ended_at`, `is_active`

### `stock_movements`

- `id`, `tenant_id`, `product_id`
- `type` (`IN`|`OUT`)
- `quantity`
- `reference_type` (`PURCHASE`|`SALE`|`ADJUSTMENT`)
- `reference_id`, `reference_table`
- `branch_id`, `terminal_id`, `pos_session_code`, `user_id`
- `stock_before`, `stock_after`, `created_at`
