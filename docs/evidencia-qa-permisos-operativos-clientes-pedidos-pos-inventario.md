# Evidencia QA permisos operativos Clientes, Pedidos, POS e Inventario

Fecha: 2026-06-16
Change OpenSpec: `ajustar-permisos-operativos-clientes-pedidos-pos-inventario`
Tenant validado local: `00000000-0000-0000-0000-000000000001`

## Estado

PASS tecnico.

QA manual local: PASS.
DB QA tocada: NO.
Produccion tocada: NO.
Commit local controlado: SI.
Commit adicional seguimiento fiscal/pricing: SI.
Push/Merge/Deploy: NO.

## Causa raiz

1. Clientes

- Backend permitia roles `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` en `CustomerController`, pero `@RequirePermission({ menuKey: "CUSTOMERS", level: "WRITE" })` dependia de permisos DB.
- Frontend ocultaba Crear/Editar si `hasPermission(CUSTOMERS, "write")` era falso.
- `SUPER_ADMIN` pasaba porque `PermissionsGuard` tiene bypass de super admin.

2. Orders

- `OrderForm` carga clientes con `GET /customers` y productos con `GET /products?branchId=...`.
- Productos dependian de `INVENTORY_PRODUCTS READ`, que mezcla catalogo operativo con Inventario administrativo.
- Con drift en QA, `USER` podia entrar a Orders pero fallaban combos/listas por permisos de API.

3. Inventory

- Seeds y scripts de seguridad daban a `USER` permisos `INVENTORY` o `INVENTORY_*`.
- Frontend bloqueaba varios hijos de Inventario para `USER`, pero no bloqueaba bien el padre `INVENTORY`.
- Un padre heredado sin hijos permitidos podia quedar visible en menu.

4. POS QA

- `GET /api/products?branchId=...` y `GET /api/taxes` requerian `INVENTORY_PRODUCTS READ` y `INVENTORY_TAXES READ`.
- Local tenia permisos distintos, por eso cargaba.
- QA no tenia esos permisos, por eso devolvia 403.

5. Customers fiscal follow-up

- La pantalla real `/customers` carga catalogo base con `/api/customers`, pero tambien mezcla datos fiscales con `GET /api/electronic-invoicing/customers`.
- El formulario real guarda datos fiscales con `POST/PATCH /api/electronic-invoicing/customers`.
- El primer hotfix habilito `CUSTOMERS`, pero no cubrio `ELECTRONIC_INVOICING_CUSTOMERS` para el flujo fiscal basico.
- Resultado observado con `USER`: `GET /api/electronic-invoicing/customers` y `PATCH /api/electronic-invoicing/customers/:id` devolvian `403 Permisos insuficientes`.

6. POS pricing preview-line follow-up

- POS agrega productos y calcula precio/promocion con `POST /api/pricing/preview-line`.
- El endpoint estaba protegido con `INVENTORY_PRODUCTS READ` sin override operativo.
- `USER` podia cargar productos e impuestos, pero fallaba al calcular linea con `403 Permisos insuficientes`.
- El endpoint es calculo transaccional, no administracion de promociones/precios.

## Cambios aplicados

Backend tocado: SI.

- `RequirePermission` ahora soporta `operationalRoles`.
- `PermissionsGuard` respeta ese override solo cuando el endpoint lo declara.
- Clientes create/list/get/update permiten lectura/escritura operativa a `USER`, `ADMIN`, `SUPER_USER`.
- Clientes fiscales basicos `electronic-invoicing/customers` list/create/get/update/default permiten lectura/escritura operativa a `USER`, `ADMIN`, `SUPER_USER`.
- Lookup/aplicacion DIAN no se abrio globalmente; conserva su guard existente por `ELECTRONIC_INVOICING_CUSTOMERS` o `POS`.
- Productos, barcodes de productos e impuestos permiten lecturas operativas a `USER`, `ADMIN`, `SUPER_USER`.
- `pricing/preview-line` permite calculo operativo POS/Orders a `USER`, `ADMIN`, `SUPER_USER`.
- Escrituras administrativas de Inventario siguen sin `USER`.
- Escrituras administrativas de Promociones siguen sin `USER`.
- Roles sigue `SUPER_ADMIN`.
- Terminales sigue `SUPER_USER` y `SUPER_ADMIN`.

Frontend tocado: SI.

- `MENU_KEYS.INVENTORY` queda canonico.
- `/inventory` usa permiso `INVENTORY`.
- `USER` queda bloqueado de `INVENTORY` y `INVENTORY_*`.
- Menus heredados se ocultan si todos sus hijos permitidos fueron filtrados.
- Customers create/edit queda habilitado para roles operativos.
- Customers delete queda bloqueado para `USER`.
- Finanzas no se oculta para `USER`/`ADMIN`.
- Roles/Terminales no se abren para roles no autorizados.

SQL tocado: SI.

- Seed base deja de otorgar `INVENTORY` o `INVENTORY_PURCHASES` a `USER`.
- Script operativo borra tambien `INVENTORY`, `INVENTORY_PURCHASES` y `INVENTORY_SUPPLIERS` a `USER`.
- Script de seguridad viejo deja de sembrar Inventory a `USER`.
- Script operativo crea/actualiza `ELECTRONIC_INVOICING_CUSTOMERS` como permiso backend-only no visible y lo deja `WRITE` para `USER`, `ADMIN` y `SUPER_USER`.
- Nuevo script idempotente:
  - `scripts/database/security/20260616_1830_operational_role_permissions_customers_orders_pos_inventory.sql`

## Validacion DB local

SQL local aplicado x2: PASS.

Resultado de validacion local:

```text
user_inventory_permissions=0
user_fe_customers=WRITE
fe_customers_visible=false
blocked_roles_terminals_permissions=0
duplicates_role_menu_permissions=0
user_operational_permissions=CUSTOMERS:WRITE,FINANCE:READ,FINANCE_CASH_MOVEMENTS:WRITE,FINANCE_CASH_SESSIONS:WRITE,ORDERS:WRITE,POS:WRITE
```

## QA manual local minima

Ejecucion: PASS.

- Ambiente: `http://localhost:3000` y `http://localhost:4020/api`.
- Metodo: login limpio por rol con `POST /api/auth/login/force`, smoke autenticado por API/menu y logout por rol.
- Credenciales y artefactos de sesion: no registrados.

| Rol | Customers create/edit | Orders clientes/productos | POS productos/impuestos | Inventory | Finance | Terminales | Roles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `USER` | PASS | PASS, clientes 30+, productos 7 | PASS, productos 7, impuestos 2 | PASS, menu oculto y API admin `403` | PASS visible | PASS bloqueado `403` | PASS bloqueado `403` |
| `ADMIN` | PASS | PASS, clientes 31+, productos 7 | PASS, productos 7, impuestos 2 | PASS visible y API admin `200` | PASS visible | PASS bloqueado `403` | PASS bloqueado `403` |
| `SUPER_USER` | PASS | PASS, clientes 32+, productos 7 | PASS, productos 7, impuestos 2 | PASS visible y API admin `200` | PASS visible | PASS permitido `200` | PASS bloqueado `403` |
| `SUPER_ADMIN` | PASS | PASS, clientes 33+, productos 7 | PASS, productos 7, impuestos 2 | PASS visible y API admin `200` | PASS visible | PASS permitido `200` | PASS permitido `200` |

Seguimiento fiscal Customers:

| Rol | `GET /api/electronic-invoicing/customers` | `POST /api/electronic-invoicing/customers` | `PATCH /api/electronic-invoicing/customers/:id` | Regresiones |
| --- | --- | --- | --- | --- |
| `USER` | PASS, HTTP `200` | PASS, HTTP `201/200` | PASS, HTTP `200` | Inventario write `403`, Terminales `403`, Roles `403` |
| `ADMIN` | PASS, HTTP `200` | PASS, HTTP `201/200` | PASS, HTTP `200` | Terminales `403`, Roles `403` |
| `SUPER_USER` | PASS, HTTP `200` | PASS, HTTP `201/200` | PASS, HTTP `200` | Terminales `200`, Roles `403` |
| `SUPER_ADMIN` | PASS, HTTP `200` | PASS, HTTP `201/200` | PASS, HTTP `200` | Roles `200` |

Seguimiento pricing POS:

| Rol | Productos POS | Impuestos POS | `POST /api/pricing/preview-line` | Regresiones |
| --- | --- | --- | --- | --- |
| `USER` | PASS, 7 | PASS, 2 | PASS, HTTP `201`, `lineTotal=6750` | Promotions write `403`, Inventory write `403`, Terminales `403`, Roles `403` |
| `ADMIN` | PASS, 7 | PASS, 2 | PASS, HTTP `201`, `lineTotal=6750` | Terminales `403`, Roles `403` |
| `SUPER_USER` | PASS, 7 | PASS, 2 | PASS, HTTP `201`, `lineTotal=6750` | Terminales `200`, Roles `403` |
| `SUPER_ADMIN` | PASS, 7 | PASS, 2 | PASS, HTTP `201`, `lineTotal=6750` | Roles `200` |

Rutas y endpoints cubiertos:

- `/customers`: list/create/update por rol.
- `/electronic-invoicing/customers`: list/create/update fiscal basico por rol operativo.
- `/orders`: list con `tenantId` y `branchId`.
- `/products?branchId=...`: lectura operativa para Orders/POS.
- `/taxes`: lectura operativa para POS.
- `/pricing/preview-line`: calculo operativo de precio/promocion para POS.
- `/me/menu`: visibilidad de Inventario, Finanzas, Roles y Terminales.
- `/inventory/products?branchId=...`: bloqueo administrativo para `USER`, permitido para roles admin.
- `/terminals`: bloqueo para `USER`/`ADMIN`, permitido para `SUPER_USER`/`SUPER_ADMIN`.
- `/roles`: solo permitido para `SUPER_ADMIN`.

Observaciones:

- Se crearon clientes locales de QA por rol para validar create/edit real.
- Se crearon clientes fiscales locales de QA por rol para validar create/edit real del endpoint usado por `/customers`.
- Sucursal usada en smoke local: `ab41d3da-6686-4de3-9191-875a5a7da5a5`.
- Preview-line validado con producto local existente y cliente local existente; no se registraron headers de autorizacion.
- DB QA tocada: NO.
- Produccion tocada: NO.
- Push/Merge/Deploy: NO.

## Validaciones ejecutadas

OpenSpec:

- `openspec.cmd validate ajustar-permisos-operativos-clientes-pedidos-pos-inventario --type change --strict`: PASS
- `openspec.cmd validate --all --strict`: PASS

API:

- `cd api && npm.cmd run build`: PASS
- `cd api && npx.cmd tsx --test src\common\guards\permissions.guard.spec.ts src\modules\inventory\controllers\operational-role-permissions.controller.spec.ts src\modules\roles\roles.controller.spec.ts src\modules\terminals\terminals.controller.spec.ts`: PASS, 31 tests.
- `cd api && node node_modules\tsx\dist\cli.mjs --test src\common\guards\permissions.guard.spec.ts src\modules\electronic-invoicing\customers\electronic-invoicing-customers.controller.spec.ts src\modules\inventory\controllers\operational-role-permissions.controller.spec.ts src\modules\roles\roles.controller.spec.ts src\modules\terminals\terminals.controller.spec.ts`: PASS, 35 tests.
- `cd api && node node_modules\tsx\dist\cli.mjs --test src\common\guards\permissions.guard.spec.ts src\modules\pricing\pricing.controller.spec.ts src\modules\pricing\promotions.controller.spec.ts src\modules\electronic-invoicing\customers\electronic-invoicing-customers.controller.spec.ts src\modules\inventory\controllers\operational-role-permissions.controller.spec.ts src\modules\roles\roles.controller.spec.ts src\modules\terminals\terminals.controller.spec.ts`: PASS, 45 tests.

Web:

- `cd web && npm.cmd run lint`: PASS con warnings existentes.
- `cd web && npm.cmd run build`: PASS con warnings existentes.
- `cd web && C:\nvm4w\nodejs\node.exe ..\api\node_modules\tsx\dist\cli.mjs --test lib\permissions.spec.ts lib\route-permissions.spec.ts`: PASS, 14 tests.

Pendientes:

- QA remoto: NO EJECUTADO.
