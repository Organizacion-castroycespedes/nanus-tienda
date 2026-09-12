# Endpoints reales

## Auth

| Metodo | Ruta | Auth |
|---|---|---|
| POST | `/api/auth/login` | No |
| POST | `/api/auth/login/replace-session` | No |
| POST | `/api/auth/forgot-password` | No |
| POST | `/api/auth/reset-password` | No |
| POST | `/api/auth/logout` | No |
| POST | `/api/auth/refresh` | No |
| GET | `/api/auth/me` | Bearer |
| GET | `/api/auth/menu` | Bearer |
| PATCH | `/api/auth/me` | JWT |
| PATCH | `/api/auth/me/password` | JWT |
| GET | `/api/auth/context` | JWT |

## Menu y permisos

| Metodo | Ruta | Observacion |
|---|---|---|
| GET | `/api/me/menu` | Menu dinamico del usuario |
| GET | `/api/me/permissions` | Permisos efectivos |
| GET | `/api/permissions/menu` | Permisos de un rol por tenant |
| POST | `/api/admin/menu-items` | Solo `SUPER_ADMIN` |
| GET | `/api/admin/menu-items` | Solo `SUPER_ADMIN` |
| GET | `/api/admin/menu-items/:id` | Solo `SUPER_ADMIN` |
| PATCH | `/api/admin/menu-items/:id` | Solo `SUPER_ADMIN` |
| PATCH | `/api/admin/menu-items/:id/status` | Solo `SUPER_ADMIN` |
| DELETE | `/api/admin/menu-items/:id` | Solo `SUPER_ADMIN` |
| GET | `/api/admin/roles/:roleId/menu-permissions` | Solo `SUPER_ADMIN` |
| PUT | `/api/admin/roles/:roleId/menu-permissions` | Solo `SUPER_ADMIN` |
| PATCH | `/api/admin/roles/:roleId/menu-permissions` | Solo `SUPER_ADMIN` |

## Tenants, branches y terminals

| Metodo | Ruta |
|---|---|
| GET | `/api/tenants` |
| POST | `/api/tenants` |
| PUT | `/api/tenants/:id` |
| GET | `/api/tenants/:id/config` |
| PUT | `/api/tenants/:id/config` |
| GET | `/api/tenants/:id/details` |
| PUT | `/api/tenants/:id/details` |
| DELETE | `/api/tenants/:id/details` |
| GET | `/api/branches` |
| GET | `/api/branches/:id` |
| POST | `/api/branches` |
| PUT | `/api/branches/:id` |
| PATCH | `/api/branches/:id/status` |
| GET | `/api/terminals` |
| POST | `/api/terminals` |
| PATCH | `/api/terminals/:id` |
| PATCH | `/api/terminals/:id/status` |

## Usuarios y roles

| Metodo | Ruta |
|---|---|
| GET | `/api/users` |
| GET | `/api/users/:id` |
| POST | `/api/users` |
| PATCH | `/api/users/:id` |
| PATCH | `/api/users/:id/password` |
| GET | `/api/roles` |
| POST | `/api/roles` |
| PUT | `/api/roles/:id` |

## Catalogos y operacion

| Metodo | Ruta |
|---|---|
| GET | `/api/locations/paises` |
| GET | `/api/locations/departamentos` |
| GET | `/api/locations/municipios` |
| GET | `/api/products` |
| POST | `/api/products` |
| GET | `/api/products/:id` |
| PUT | `/api/products/:id` |
| DELETE | `/api/products/:id` |
| GET | `/api/inventory/products` |
| GET | `/api/units` |
| POST | `/api/units` |
| PUT | `/api/units/:id` |
| DELETE | `/api/units/:id` |
| GET | `/api/taxes` |
| POST | `/api/taxes` |
| PUT | `/api/taxes/:id` |
| DELETE | `/api/taxes/:id` |
| GET | `/api/suppliers` |
| POST | `/api/suppliers` |
| GET | `/api/suppliers/:id` |
| PUT | `/api/suppliers/:id` |
| DELETE | `/api/suppliers/:id` |
| GET | `/api/customers` |
| POST | `/api/customers` |
| GET | `/api/customers/:id` |
| PUT | `/api/customers/:id` |
| DELETE | `/api/customers/:id` |
| GET | `/api/purchases` |
| POST | `/api/purchases` |
| GET | `/api/purchases/:id` |
| PUT | `/api/purchases/:id` |
| POST | `/api/purchases/:id/receive` |
| PATCH | `/api/purchases/:id/cancel` |
| PATCH | `/api/purchases/:id/settle-partial` |

### Liquidacion parcial de compra

| Campo | Valor |
| --- | --- |
| Ruta UI | `/[tenant]/inventory/purchases` |
| Endpoint conceptual | `PATCH /api/inventory/purchases/:purchaseId/settle-partial` |
| Endpoint real actual | `PATCH /api/purchases/:purchaseId/settle-partial` |
| Estado destino | `CERRADA_PARCIAL` |
| Permiso | `INVENTORY_PURCHASES` accion `settle_partial` |
| Regla principal | Cierra la compra tomando como valor final el total realmente recibido |
| Restriccion | Bloquea si los pagos registrados superan el valor recibido |

| GET | `/api/orders` |
| POST | `/api/orders` |
| GET | `/api/orders/:id` |
| PUT | `/api/orders/:id` |
| POST | `/api/orders/:id/deliver` |
| POST | `/api/orders/:id/confirm` |
| POST | `/api/orders/:id/invoice` |
| POST | `/api/orders/:id/cancel` |
| GET | `/api/sales` |
| POST | `/api/sales` |
| GET | `/api/sales/:id` |
| POST | `/api/sales/:id/cancel` |
| POST | `/api/stock-adjustments` |
| POST | `/api/pos/session` |
| GET | `/api/pos/session/current` |
