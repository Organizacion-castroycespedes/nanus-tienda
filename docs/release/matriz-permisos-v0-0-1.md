# Matriz de permisos v0.0.1

## Alcance

Esta matriz resume permisos observados desde:

- `scripts/database/003_seed_roles.sql`
- `scripts/database/007_seed_role_menu_permissions.sql`
- `scripts/database/security/*`
- `web/lib/route-permissions.ts`
- `web/domains/menu/constants.ts`
- evidencias QA de permisos operativos

No se ejecuto SQL para construir esta matriz. No se modificaron permisos.

## Roles base

| Rol | Descripcion |
| --- | --- |
| `SUPER_ADMIN` | Administrador global, bypass alto en guards y visibilidad cross-tenant. |
| `SUPER_USER` | Usuario corporativo con acceso operativo global dentro de su tenant. |
| `ADMIN` | Administrador operativo de tenant/sucursal con permisos funcionales amplios. |
| `USER` | Usuario operativo enfocado en POS, pedidos, clientes y caja restringida. |

## Leyenda

- `W`: lectura y escritura/acciones principales.
- `R`: solo lectura o vista.
- `OP`: acceso operativo especifico, no administracion completa.
- `-`: sin acceso esperado.
- `EXT`: depende de integracion externa o feature flag.

## Matriz por modulo

| Modulo / capacidad | SUPER_ADMIN | SUPER_USER | ADMIN | USER | Notas |
| --- | --- | --- | --- | --- | --- |
| Dashboard | R | R | R | R | Ruta `/{tenant}/dashboard`. |
| POS | W | W | W | W | USER opera POS; venta y pricing preview habilitados. |
| Pedidos / Orders | W | W | W | W | Evidencia operativa habilita USER para flujo de pedidos. |
| Clientes | W | W | W | OP | USER crea/edita; delete restringido. |
| Clientes fiscales base | W | W | W | OP | Endpoints basicos FE customers abiertos por QA operativa; DIAN lookup conserva guards. |
| Proveedores | W | W | W | - | Suppliers admin no queda como flujo USER base. |
| Compras / Recepcion | W | W | W | - | USER no debe administrar compras en v0.0.1. |
| Inventario dashboard | W | W | W | - | USER bloqueado de inventario administrativo. |
| Productos admin | W | W | W | - | USER lee productos por POS/Orders, no administra. |
| Categorias/subcategorias | W | W | W | - | Permisos equivalentes a productos. |
| Unidades | W | W | W | - | Lectura operativa indirecta segun flujo. |
| Impuestos | W | W | W | OP | USER lee impuestos para POS, no administra catalogo. |
| Lotes/ubicaciones | W | W | W | - | Uso operativo indirecto por POS/compras. |
| Ajustes stock | W | W | W | - | USER excluido de ajustes administrativos. |
| Promociones admin | W | W | W | - | Permiso `INVENTORY_PROMOTIONS`; USER no administra. |
| Pricing preview | W | W | W | OP | USER puede calcular precio desde POS/Orders. |
| Finanzas raiz | W | W | R/W parcial | R | Scope depende de cash sessions/movements. |
| Cash sessions | W | W | W | OP | USER puede operar apertura/movimientos segun flujo validado. |
| Cash movements | W | W | W | OP | USER con acciones operativas controladas. |
| Cash registers | W | W | R | - | Segun seed base, ADMIN lectura; USER no administra. |
| Payment methods | W | W | W | R | Lectura operativa para POS/pagos. |
| Reporteria | W | W | R | R | Scope por rol/tenant/sucursal en `web/modules/reporteria`. |
| Configuracion general | W | W | W | - | Ruta `/{tenant}/configuracion`. |
| Menu admin | W | - | - | - | `CONFIG_MENU`, solo SUPER_ADMIN en practica. |
| Roles | W | - | - | - | Evidencia: roles solo SUPER_ADMIN. |
| Usuarios | W | W | - | - | Admin/User no administran usuarios base. |
| Tenants | W | R tenant | - | - | SUPER_USER limitado a su tenant. |
| Branches | W | R/W tenant | R asignadas | R asignadas | Scope por rol y branch asignada. |
| Terminales config | W | W | - | - | Evidencia: ADMIN/USER bloqueados para `/terminals`. |
| POS peripherals config | W | W | W | - | Config MOCK/admin; hardware real fuera. |
| Perifericos fisicos | EXT | EXT | EXT | EXT | Bloqueado por hardware/adapters reales. |
| Facturacion electronica DIAN real | EXT | EXT | EXT | EXT | Bloqueado por certificado/habilitacion. |

## Route permission rules frontend

Rutas protegidas por `web/lib/route-permissions.ts`:

| Ruta | Permiso requerido |
| --- | --- |
| `/{tenant}/dashboard` | `DASHBOARD.read` |
| `/{tenant}/configuracion` | `CONFIG_GENERAL.read` |
| `/{tenant}/config/terminals` | `CONFIG_TERMINALS.read` |
| `/{tenant}/configuracion/menu` | `CONFIG_MENU.read` |
| `/{tenant}/admin/peripherals` | `peripherals.manage` |
| `/{tenant}/roles` | `CONFIG_ROLES.read` |
| `/{tenant}/usuarios` | `CONFIG_USUARIOS.read` |
| `/{tenant}/inventory` | `INVENTORY.read` |
| `/{tenant}/inventory/products` | `INVENTORY_PRODUCTS.read` |
| `/{tenant}/inventory/promotions` | `INVENTORY_PROMOTIONS.read` |
| `/{tenant}/inventory/units` | `INVENTORY_UNITS.read` |
| `/{tenant}/inventory/locations` | `INVENTORY_LOCATIONS.read` |
| `/{tenant}/inventory/lots` | `INVENTORY_LOTS.read` |
| `/{tenant}/inventory/taxes` | `INVENTORY_TAXES.read` |
| `/{tenant}/inventory/purchases` | `INVENTORY_PURCHASES.read` |
| `/{tenant}/inventory/suppliers` | `INVENTORY_SUPPLIERS.read` |
| `/{tenant}/pos` | `pos.read` |
| `/{tenant}/customers` | `CUSTOMERS.read` |
| `/{tenant}/orders` | `ORDERS.read` |
| `/{tenant}/finance/*` | `FINANCE.read` |
| `/{tenant}/reporteria/*` | `reporteria.read` |

## Riesgos de permisos

- Si seeds/migraciones no estan aplicados en el ambiente destino, la matriz puede tener drift.
- Existen permisos canonicos y aliases legacy (`DASHBOARD_TENANT_DASHBOARD`, `USUARIOS_TENANT_USUARIOS`, etc.).
- Algunos flujos operativos usan permisos backend-only no visibles en menu.
- No cambiar permisos dentro de `v0.0.1`; cualquier ajuste debe ser un change OpenSpec separado.
