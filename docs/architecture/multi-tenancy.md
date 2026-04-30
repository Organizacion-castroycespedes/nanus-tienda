# Multi-tenancy

## Estrategia real

La aplicacion usa base de datos compartida con aislamiento logico por `tenant_id`.

## Donde se aplica

- `tenants`, `users`, `personas`, `tenant_branches`, `user_roles`
- `menu_items`, `role_menu_permissions`
- `auth_refresh_tokens`, `auth_sessions`, `pos_user_sessions`
- Tablas operativas inferidas: `products`, `customers`, `suppliers`, `units`, `taxes`, `orders`, `purchases`, `sales`, `stock_movements`, `terminals`

## Fuentes de tenant en runtime

- JWT: `tenant_id`
- Request auth: `request.user.tenantId`
- Contexto POS: `request.context.tenantId`
- Middleware antiguo: `tenantMiddleware` por `x-tenant` o `req.params.tenant`

## Reglas observadas

- `SUPER_ADMIN` puede cruzar tenants en varios endpoints administrativos.
- `SUPER_USER` suele operar sobre configuracion del tenant y sucursales/terminales.
- `ADMIN` y `USER` quedan normalmente restringidos al tenant del token.
- En inventario, compras y pedidos se resuelve el tenant desde el actor antes de aceptar filtros.

## Aislamiento por sucursal y terminal

- Sucursal: `tenant_branches`
- Terminal: `terminals` asociada a `tenant_id` + `branch_id`
- POS: la sesion activa enlaza usuario, tenant, sucursal y terminal antes de vender.
