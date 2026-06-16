# Evidencia auditoria accesos por roles y modulos

Fecha: 2026-06-12

## Alcance

Revision de `api/`, `web/`, `backend-reporteria/`, `api/database/` y `scripts/database/` para roles oficiales:

- `SUPER_ADMIN`
- `SUPER_USER`
- `ADMIN`
- `USER`

La evidencia runtime depende de ejecutar `scripts/database/audit/access-control-audit.sql` contra la base local o QA. En esta fase no se toco produccion.

## Roles existentes

Detectado en seeds:

- `scripts/database/003_seed_roles.sql`: crea `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER`.
- `api/database/initial_schema.sql`: crea `SUPER_ADMIN` inicial.
- `scripts/database/009_seed_demo_operational_users.sql`: usuarios demo para `SUPER_USER`, `ADMIN`, `USER`.
- `scripts/database/004_seed_super_admin.sql`: usuario `SUPER_ADMIN`.

## Modulos detectados

Detectado en SQL, controllers y rutas frontend:

| Modulo | Evidencia |
|---|---|
| Dashboard | `DASHBOARD`, `/[tenant]/dashboard` |
| POS | `POS`, `sales`, `/[tenant]/pos` |
| Orders / Pedidos | `ORDERS`, `orders`, `/[tenant]/orders` |
| Inventory | `INVENTORY`, `inventory/*`, `/[tenant]/inventory` |
| Products | `INVENTORY_PRODUCTS`, `products` |
| Purchases | `INVENTORY_PURCHASES`, `purchases` |
| Customers | `CUSTOMERS`, `CRM_CUSTOMERS`, `customers`, FE customers |
| Suppliers | `INVENTORY_SUPPLIERS`, `suppliers`, FE suppliers |
| Reports | `REPORTS*`, `backend-reporteria`, `/[tenant]/reporteria/*` |
| Cash / Caja | `FINANCE_CASH_*`, `finance/cash-*` |
| Settings | `CONFIG_GENERAL`, `/[tenant]/configuracion` |
| Users | `CONFIG_USUARIOS`, `users` |
| Roles | `CONFIG_ROLES`, `roles` |
| Menus | `CONFIG_MENU`, `admin/menu-items` |
| Branches | `branches`, `tenant_branches` |
| Tenants | `tenants` |
| Pricing | `pricing`, `pricing/promotions` |
| Payment Methods | `FINANCE_PAYMENT_METHODS` |
| Peripherals | `POS_PERIPHERALS`, `pos-terminals`, `backend-perifericos` |
| Fiscal / FE | `ELECTRONIC_INVOICING_CUSTOMERS`, `ELECTRONIC_INVOICING_SUPPLIERS` |

## Menus detectados

Fuentes:

- `scripts/database/006_seed_menu_items.sql`
- `scripts/database/007_seed_role_menu_permissions.sql`
- `scripts/database/products/*.sql`
- `scripts/database/finance/patches/20260502_1135_finance_menu_access.sql`
- `scripts/database/migrations/20260505_reporting_menu_items_routes_upsert.sql`
- `scripts/database/migrations/20260508_reporting_routes_permissions.sql`
- `scripts/database/migrations/20260509_reporting_phase5_routes_permissions.sql`
- `scripts/database/migrations/20260606_pricing_promotions_menu_permissions.sql`
- `scripts/database/012_seed_electronic_invoicing_suppliers_menu_permissions.sql`

## Rutas frontend detectadas

Rutas protegidas por `web/app/[tenant]/layout.tsx` y `web/lib/route-permissions.ts`:

| Ruta | Modulo/permiso |
|---|---|
| `/[tenant]/dashboard` | `DASHBOARD.read` |
| `/[tenant]/pos` | `pos.read` |
| `/[tenant]/pos/select-context` | `pos.read` |
| `/[tenant]/orders` | `inventory.read` |
| `/[tenant]/purchases` | `inventory.read` |
| `/[tenant]/inventory/*` | `inventory.read` |
| `/[tenant]/inventory/promotions` | `INVENTORY_PROMOTIONS.read` |
| `/[tenant]/customers` | `customers.read` |
| `/[tenant]/suppliers` | `inventory.read` |
| `/[tenant]/finance/*` | `finance.read` |
| `/[tenant]/reporteria/*` | `reporteria.read` |
| `/[tenant]/configuracion` | `CONFIG_GENERAL.read` |
| `/[tenant]/config/terminals` | `CONFIG_GENERAL.read` |
| `/[tenant]/configuracion/menu` | `CONFIG_MENU.read` |
| `/[tenant]/usuarios` | `CONFIG_USUARIOS.read` |
| `/[tenant]/roles` | `CONFIG_ROLES.read` |
| `/[tenant]/admin/peripherals` | `peripherals.manage` |

## Endpoints backend detectados

| Endpoint | Metodo | Proteccion detectada | Estado |
|---|---|---|---|
| `/api/auth/login` | POST | Publico por diseno | OK |
| `/api/auth/refresh` | POST | Refresh token | OK |
| `/api/auth/me`, `/api/auth/menu` | GET | Token manual + sesion en service | OK |
| `/api/me/menu`, `/api/me/permissions` | GET | `JwtAuthGuard` | Endurecido |
| `/api/permissions/menu` | GET | `JwtAuthGuard`, `RolesGuard`, `SUPER_ADMIN` | Endurecido |
| `/api/users/*` | GET/POST/PATCH | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `CONFIG_USUARIOS` | OK |
| `/api/roles/*` | GET/POST/PUT | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `CONFIG_ROLES` | OK |
| `/api/admin/menu-items*` | CRUD | `JwtAuthGuard`, `RolesGuard`, `SUPER_ADMIN` | OK |
| `/api/tenants` | GET | `SUPER_ADMIN`, `SUPER_USER`; `SUPER_USER` limitado a su tenant | Endurecido |
| `/api/branches` | GET | `SUPER_ADMIN` global, `SUPER_USER` tenant, `ADMIN/USER` branches asignadas | Endurecido |
| `/api/products*` | CRUD | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `INVENTORY_PRODUCTS` | OK |
| `/api/purchases*` | CRUD/actions | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `INVENTORY_PURCHASES` | OK |
| `/api/orders*` | CRUD/actions | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `ORDERS` | OK |
| `/api/sales*` | CRUD/actions | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `POS` | OK |
| `/api/pos/session*` | GET/POST | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `POS` | Endurecido |
| `/api/units*`, `/api/taxes*` | CRUD | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `INVENTORY` | Endurecido |
| `/api/customers*` | CRUD | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `CUSTOMERS` | Endurecido |
| `/api/suppliers*` | CRUD | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `INVENTORY_SUPPLIERS` | Endurecido |
| `/api/stock-adjustments` | POST | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `INVENTORY.WRITE`; `USER` excluido | Endurecido |
| `/api/finance/*` | GET/POST/PATCH | `JwtAuthGuard`, `RolesGuard`, `FinanceAuthzGuard`, service scope | OK |
| `backend-reporteria/reports/*` | GET | `JwtAuthGuard`, `ReportAuthzGuard`, mock auth configurable | Riesgo DEV default |
| `/api/system/version` | GET | Publico | Aceptable si solo expone version |

## Matriz esperada resumida

| Modulo | Accion | SUPER_ADMIN | SUPER_USER | ADMIN | USER |
|---|---|---|---|---|---|
| Tenants | READ_GLOBAL | Si | No | No | No |
| Branches | READ_GLOBAL | Si | No | No | No |
| Branches | READ_TENANT | Si | Si | No | No |
| Branches | READ_ASSIGNED | Si | Si | Si | Si |
| POS | READ/CREATE | Si | Si | Si | Si |
| Orders | READ/CREATE/UPDATE | Si | Si | Si | Si limitado |
| Orders | CANCEL | Si | Si | Si | No/limitado por permiso |
| Purchases | READ | Si | Si | Si | Si limitado |
| Purchases | CREATE/RECEIVE | Si | Si | Si | No/limitado por permiso |
| Inventory | ADJUST | Si | Si | Si | No |
| Reports | READ_GLOBAL | Si | No | No | No |
| Reports | READ_TENANT | Si | Si | No/limitado | No |
| Reports | READ_BRANCH | Si | Si | Si | No/limitado |
| Settings | READ/WRITE | Si | Si limitado | No | No |
| Users | MANAGE | Si | Si limitado por tenant | No | No |
| Roles | MANAGE | Si | No | No | No |
| Menus | MANAGE | Si | No | No | No |

## Brechas detectadas

| Brecha | Impacto | Estado |
|---|---|---|
| `BranchesService` trataba `SUPER_USER` como global | Podia listar sucursales fuera de tenant | Corregido |
| `TenantsController.list` permitia a `SUPER_USER` listar todos los tenants | Exposicion cross-tenant | Corregido |
| `PermissionsController.getMenu` era publico | Consulta arbitraria de permisos por role/tenant | Corregido |
| `web/lib/permissions.ts` trataba `ADMIN` como privilegiado global | UI podia mostrar rutas/acciones indebidas | Corregido |
| `route-permissions.ts` no cubria finance/reporteria/pos context | URL directa podia entrar sin regla central | Corregido |
| `backend-reporteria` permite mock auth por defecto | Riesgo si llega a QA/PRD con default | Pendiente: exigir `REPORTS_ALLOW_MOCK_AUTH=false` en QA/PRD |
| Controllers catalogo/operativos tenian solo `JwtAuthGuard` (`units`, `taxes`, `customers`, `suppliers`, `pos/session`) | Acceso amplio sin permiso por modulo | Corregido |

## SQL de auditoria

Archivo creado:

- `scripts/database/audit/access-control-audit.sql`

Contiene solo `SELECT`.
