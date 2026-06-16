# Evidencia QA accesos por roles y modulos

Fecha: 2026-06-12  
Change OpenSpec: `auditoria-accesos-roles`  
Resultado QA inicial: **FAIL**  
Resultado post-fix: **PASS CON OBSERVACIONES**

El QA valida comportamiento real en DB local/QA, API principal, frontend disponible y `backend-reporteria`. No se ejecuto SQL destructivo. No se tocaron ambientes productivos. No se documentan contrasenas.

## 1. Resumen ejecutivo

La implementacion compila y las pruebas automatizadas pasan. El QA efectivo inicial encontro brechas que impedian aprobar el control de accesos:

- `ADMIN` y `USER` pueden consultar productos de una sucursal no asignada usando `GET /api/products?branchId=<otra_sucursal>`.
- `SUPER_USER` puede consultar `GET /api/roles` con HTTP 200, aunque la regla oficial indica que no debe administrar roles globales.
- `SUPER_USER` envia `tenantId` ajeno en `GET /api/tenants?tenantId=<tenant_ajeno>` y recibe HTTP 200. No hay fuga observada en esta prueba, pero la regla pide rechazo claro.
- `backend-reporteria` acepta reportes sin JWT porque `REPORTS_ALLOW_MOCK_AUTH` no esta deshabilitado en el ambiente probado. `USER` y requests sin auth reciben HTTP 200 en reportes.
- QA visual real de menu/rutas directas en navegador no pudo completarse porque Browser plugin fallo con `windows sandbox failed: spawn setup refresh`; se hizo verificacion estatica y HTTP de compilacion.

Correccion post-fix:

- `GET /api/products?branchId=<branch_no_asignada>` ahora retorna 403 para `ADMIN` y `USER`.
- `GET /api/roles` ahora retorna 403 para `SUPER_USER`.
- `GET /api/tenants?tenantId=<tenant_ajeno>` ahora retorna 403 para `SUPER_USER`.
- `backend-reporteria` ahora retorna 401 sin JWT por defecto.
- `backend-reporteria` ahora retorna 403 para `USER` en reportes.
- Rutas frontend sensibles usan menu keys especificas para productos, compras, proveedores, pedidos y clientes.

## 2. Ambiente usado

| Componente | Ambiente | Resultado |
|---|---|---|
| DB | `scripts/config/db.env`, clasificado como local/QA | Conectado con `psql` |
| API principal | `http://localhost:4020/api` | Reiniciado desde `api/src/main.ts` para usar codigo actual |
| Web | `http://localhost:3000` | Reiniciado en modo dev para compilar rutas actuales |
| Reporteria | `http://localhost:4021/api` | Disponible |
| Produccion | No usado | PASS |

## 3. Usuarios por rol utilizados

| Rol | Usuario/email | Tenant | Branch/Sucursal | Observacion |
|---|---|---|---|---|
| SUPER_ADMIN | icastror@hotmail.com | default | Sucursal Principal | Seed local/QA |
| SUPER_USER | super.user+default@manustienda.local | default | Sucursal Principal | Seed demo |
| ADMIN | admin+default@manustienda.local | default | Sucursal Principal | Seed demo |
| USER | user+default@manustienda.local | default | Sucursal Principal | Seed demo |
| USER | user2+default@manustienda.local | default | Adelita de Char | Usuario adicional detectado |

## 4. Resultado SQL auditoria

Se ejecuto `scripts/database/audit/access-control-audit.sql` contra ambiente local/QA. El script corrio sin errores.

| Chequeo | Resultado |
|---|---:|
| Roles existentes | 4 |
| Usuarios SUPER_ADMIN | 1 |
| Usuarios SUPER_USER | 1 |
| Usuarios ADMIN | 1 |
| Usuarios USER | 2 |
| Usuarios sin rol | 0 |
| Usuarios con multiples roles | 0 |
| Usuarios sin persona | 0 |
| Usuarios sin branch | 0 |
| Roles sin permisos | 0 |
| Permisos duplicados | 0 |

Resumen de modulos por rol en DB:

| Rol | Modulos detectados |
|---|---|
| SUPER_ADMIN | configuracion, crm, customers, dashboard, finance, inventory, orders, peripherals, pos, reporteria, roles, usuarios |
| SUPER_USER | configuracion, crm, customers, dashboard, finance, inventory, orders, peripherals, pos, reporteria, usuarios |
| ADMIN | configuracion, customers, dashboard, inventory, orders, peripherals, pos |
| USER | customers, dashboard, inventory, orders, pos |

## 5. Validacion login/session

Login ejecutado con usuarios reales de QA mediante `/api/auth/login/force`.

| Rol | Login | `/auth/me` | `/auth/menu` | `/me/permissions` | Estado |
|---|---:|---:|---:|---:|---|
| SUPER_ADMIN | 201 | 200 | 200 | 200 | PASS |
| SUPER_USER | 201 | 200 | 200 | 200 | PASS |
| ADMIN | 201 | 200 | 200 | 200 | PASS |
| USER | 201 | 200 | 200 | 200 | PASS |

## 6. Matriz menu frontend

QA visual de menu no fue posible por fallo del Browser plugin. La verificacion disponible fue:

- API de menu y permisos carga 200 para los cuatro roles.
- `web/app/[tenant]/layout.tsx` filtra menu con `getAllowedMenuItems`.
- `web/lib/permissions.ts` centraliza `canAccessModule`, `canPerformAction` y `getAllowedMenuItems`.

Riesgo observado en rutas frontend:

| Ruta | Regla frontend actual | Riesgo |
|---|---|---|
| `/[tenant]/inventory/suppliers` | `inventory.read` | Puede permitir ruta directa aunque backend exige `INVENTORY_SUPPLIERS` |
| `/[tenant]/orders` | `inventory.read` | No usa `ORDERS.read` |
| `/[tenant]/purchases` | `inventory.read` | No usa `INVENTORY_PURCHASES.read` |
| `/[tenant]/reporteria/*` | `reporteria.read` | Depende de permisos/reporteria backend, que hoy permite mock auth |

## 7. Matriz URL directa

Verificacion completa en navegador queda pendiente por bloqueo del Browser plugin. Verificacion estatica:

| Caso | Evidencia | Estado |
|---|---|---|
| No autenticado | Layout redirige a `/login` cuando `authStatus` no es `authenticated` | Pendiente browser |
| Tenant ajeno | Layout redirige a `/{authUser.tenantId}/unauthorized` para no SUPER_ADMIN | Pendiente browser |
| Ruta sin permiso | Layout usa `getRoutePermissionRequirement` y `hasPermission` | Pendiente browser |
| Rutas Next compilan | `/login`, `/default/dashboard`, `/default/usuarios`, `/default/roles` dev server HTTP 200 | PASS compilacion |

## 8. Matriz endpoints backend

API principal con tokens reales:

| Rol | Endpoint | Real | Estado |
|---|---|---:|---|
| SUPER_ADMIN | `/products?branchId=<principal>` | 200 | PASS |
| SUPER_ADMIN | `/orders` | 200 | PASS |
| SUPER_ADMIN | `/purchases` | 200 | PASS |
| SUPER_ADMIN | `/customers` | 200 | PASS |
| SUPER_ADMIN | `/suppliers` | 200 | PASS |
| SUPER_ADMIN | `/finance/cash-sessions/current` | 200 | PASS |
| SUPER_ADMIN | `/users` | 200 | PASS |
| SUPER_ADMIN | `/roles` | 200 | PASS |
| SUPER_ADMIN | `/admin/menu-items?tenantId=<default>` | 200 | PASS |
| SUPER_ADMIN | `/branches` | 200 | PASS |
| SUPER_ADMIN | `/tenants` | 200 | PASS |
| SUPER_ADMIN | `/pricing/promotions` | 200 | PASS |
| SUPER_ADMIN | `/finance/payment-methods` | 200 | PASS |
| SUPER_ADMIN | `/pos-terminals` | 200 | PASS |
| SUPER_ADMIN | `/electronic-invoicing/customers` | 200 | PASS |
| SUPER_USER | `/products?branchId=<principal>` | 200 | PASS |
| SUPER_USER | `/orders` | 200 | PASS |
| SUPER_USER | `/purchases` | 200 | PASS |
| SUPER_USER | `/customers` | 200 | PASS |
| SUPER_USER | `/suppliers` | 200 | PASS |
| SUPER_USER | `/finance/cash-sessions/current` | 200 | PASS |
| SUPER_USER | `/users` | 200 | Observacion |
| SUPER_USER | `/roles` | 200 | FAIL |
| SUPER_USER | `/admin/menu-items?tenantId=<default>` | 403 | PASS |
| SUPER_USER | `/branches` | 200 | PASS |
| SUPER_USER | `/tenants` | 200 | PASS tenant propio |
| SUPER_USER | `/pricing/promotions` | 200 | PASS |
| SUPER_USER | `/finance/payment-methods` | 200 | PASS |
| SUPER_USER | `/pos-terminals` | 200 | PASS |
| SUPER_USER | `/electronic-invoicing/customers` | 403 | Observacion |
| ADMIN | `/products?branchId=<principal>` | 200 | PASS |
| ADMIN | `/orders` | 200 | PASS |
| ADMIN | `/purchases` | 200 | PASS |
| ADMIN | `/customers` | 200 | PASS |
| ADMIN | `/suppliers` | 200 | PASS |
| ADMIN | `/finance/cash-sessions/current` | 200 | PASS |
| ADMIN | `/users` | 403 | PASS |
| ADMIN | `/roles` | 403 | PASS |
| ADMIN | `/admin/menu-items?tenantId=<default>` | 403 | PASS |
| ADMIN | `/branches` | 200 | PASS |
| ADMIN | `/tenants` | 403 | PASS |
| ADMIN | `/pricing/promotions` | 200 | PASS |
| ADMIN | `/finance/payment-methods` | 200 | PASS |
| ADMIN | `/pos-terminals` | 200 | PASS |
| ADMIN | `/electronic-invoicing/customers` | 403 | Observacion |
| USER | `/products?branchId=<principal>` | 200 | PASS |
| USER | `/orders` | 200 | PASS |
| USER | `/purchases` | 200 | PASS permitido por DB actual |
| USER | `/customers` | 200 | PASS permitido por DB actual |
| USER | `/suppliers` | 403 | PASS |
| USER | `/finance/cash-sessions/current` | 200 | PASS |
| USER | `/users` | 403 | PASS |
| USER | `/roles` | 403 | PASS |
| USER | `/admin/menu-items?tenantId=<default>` | 403 | PASS |
| USER | `/branches` | 200 | PASS |
| USER | `/tenants` | 403 | PASS |
| USER | `/pricing/promotions` | 403 | PASS |
| USER | `/finance/payment-methods` | 200 | Observacion |
| USER | `/pos-terminals` | 403 | PASS |
| USER | `/electronic-invoicing/customers` | 403 | Observacion |

Sin autenticacion:

| Endpoint | Real | Estado |
|---|---:|---|
| `/products` | 401 | PASS |
| `/users` | 401 | PASS |
| `/tenants` | 401 | PASS |

## 9. Matriz acciones criticas

No se forzaron operaciones destructivas con datos reales. Se validaron denegaciones con cuerpos vacios o IDs falsos para confirmar guards antes de mutacion.

| Rol | Modulo | Accion | Real | Estado |
|---|---|---|---:|---|
| USER | Products | Crear producto | 403 | PASS |
| USER | Products | Eliminar producto | 403 | PASS |
| USER | Suppliers | Crear proveedor | 403 | PASS |
| USER | Roles | Crear rol | 403 | PASS |
| ADMIN | Roles | Crear rol | 403 | PASS |
| SUPER_USER | Menus admin | Listar menu admin | 403 | PASS |

Acciones no ejecutadas por riesgo de mutacion: crear venta POS, crear compra, cancelar compra, abrir caja, cerrar caja, registrar pago, exportar PDF real, crear usuario, editar usuario, asignar rol, editar configuracion.

## 10. Validacion filtros tenant/branch

| Rol | Caso | Real | Estado |
|---|---|---:|---|
| SUPER_USER | `/tenants?tenantId=<tenant_ajeno>` | 200 | FAIL, debe rechazar intento |
| ADMIN | `/branches?tenantId=<tenant_ajeno>` | 403 | PASS |
| USER | `/branches?tenantId=<tenant_ajeno>` | 403 | PASS |
| USER | `/products?branchId=<branch_asignada>` | 200 | PASS |
| USER | `/products?branchId=<branch_no_asignada>` | 200 | FAIL |
| ADMIN | `/products?branchId=<branch_no_asignada>` | 200 | FAIL |

## 11. Reporteria

`backend-reporteria` esta activo en `http://localhost:4021/api`. En el ambiente probado no esta definido `REPORTS_ALLOW_MOCK_AUTH=false`, por lo que el guard permite mock auth.

Con headers mock por rol:

| Rol | Endpoints reporteria probados | Real | Estado |
|---|---|---:|---|
| SUPER_ADMIN | health, pos-sales, cash-closings, purchases, order-sales, customers/orders-status | 200 | PASS local |
| SUPER_USER | mismos endpoints | 200 | Observacion |
| ADMIN | mismos endpoints | 200 | Observacion |
| USER | mismos endpoints | 200 | FAIL si se espera negar reportes amplios |

Sin autenticacion:

| Endpoint | Real | Estado |
|---|---:|---|
| `/reports/pos-sales` | 200 | FAIL si QA/PRD debe exigir JWT |
| `/reports/cash-closings` | 200 | FAIL si QA/PRD debe exigir JWT |

## 12. Regresion operativa minima

| Flujo | Rol usado | Resultado | Estado |
|---|---|---|---|
| Products lista con branch principal | Todos | 200 | PASS |
| Orders lista | Todos | 200 | PASS |
| Purchases lista | Todos | 200 | PASS |
| Customers lista | Todos | 200 | PASS |
| Suppliers lista | SUPER_ADMIN, SUPER_USER, ADMIN | 200 | PASS |
| Cash session actual | Todos | 200 | PASS |
| Payment methods lista | Todos | 200 | Observacion para USER |
| POS crear venta | No ejecutado | Pendiente QA con datos rollback | Pendiente |
| Orders crear pedido | No ejecutado | Pendiente QA con fixture | Pendiente |
| Purchases crear compra | No ejecutado | Pendiente QA con fixture | Pendiente |
| Cash close/open | No ejecutado | Pendiente QA con fixture | Pendiente |

## 13. Bugs encontrados

| Severidad | Bug | Evidencia | Recomendacion |
|---|---|---|---|
| Alta | `ADMIN`/`USER` saltan branch scope en productos | `/api/products?branchId=<branch_no_asignada>` retorna 200 | Aplicar `AccessControlService.canAccessBranch` en productos y servicios con `branchId` |
| Alta | Reporteria permite acceso sin JWT por mock auth | `/api/reports/pos-sales` en `backend-reporteria` retorna 200 sin auth | Exigir `REPORTS_ALLOW_MOCK_AUTH=false` en QA/PRD y bloquear mock en despliegue |
| Media | `SUPER_USER` recibe 200 en `/api/roles` | Endpoint retorna 200 | Aclarar si son roles tenant-locales. Si no, restringir a `SUPER_ADMIN` |
| Media | `SUPER_USER` con `tenantId` ajeno en `/api/tenants` recibe 200 | Query ajena retorna 200 | Rechazar query `tenantId` ajeno con 403 en vez de ignorar |
| Media | Rutas frontend usan permisos demasiado amplios | `/inventory/suppliers`, `/orders`, `/purchases` usan `inventory.read` | Usar claves especificas: `INVENTORY_SUPPLIERS`, `ORDERS`, `INVENTORY_PURCHASES` |
| Baja | QA browser no ejecutado | Browser plugin fallo y no existe Playwright local | Agregar Playwright o checklist manual ejecutable |

## 14. Riesgos pendientes

- Falta validar UI real: menu visible, botones y redireccion 403 en navegador autenticado.
- Falta validar acciones permitidas con fixtures transaccionales o rollback.
- Falta probar multi-tenant real porque DB local/QA solo expone tenant `default`.
- Falta probar scope de branch en orders, purchases, cash y reports con datos multi-sucursal suficientes.
- La migracion SQL de seguridad idempotente no fue ejecutada contra esta DB QA, por restriccion de no mutar DB en esta fase.

## 15. Recomendaciones

1. Corregir branch scope en todos los endpoints que aceptan `branchId`, empezando por productos.
2. Cambiar `/api/tenants` para rechazar `tenantId` ajeno en roles tenant-scoped.
3. Decidir si `SUPER_USER` puede leer roles tenant-locales. Si no, bloquear `/api/roles`.
4. Deshabilitar mock auth de reporteria fuera de desarrollo local.
5. Alinear rutas frontend con claves especificas de modulo, no solo modulos amplios.
6. Crear fixtures QA multi-tenant y multi-branch con rollback para validar operaciones reales.
7. Agregar pruebas e2e frontend con Playwright para menu, ruta directa y botones por permiso.

## 16. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `openspec.cmd validate auditoria-accesos-roles --strict` | PASS |
| `git diff --check` | PASS con warnings CRLF/LF |
| `cd api && npx.cmd tsx --test src/common/services/access-control.service.spec.ts src/common/guards/permissions.guard.spec.ts src/modules/branches/branches.service.spec.ts` | PASS, 17 tests |
| `cd api && npm.cmd run build` | PASS |
| `cd web && npm.cmd run lint` | PASS con warnings preexistentes |
| `cd web && npm.cmd run build` | PASS con warnings preexistentes |
| `cd backend-reporteria && npm.cmd run build:bin` | PASS con warnings `pkg` preexistentes |

## 17. Resultado final inicial

**FAIL**.

La base, login, guards generales y builds estan operativos. Pero el modelo oficial no queda validado por brechas reales en branch scope, reporteria mock auth y diferencias de permisos/rutas. No se recomienda archivar el change hasta corregir o aceptar formalmente estas observaciones.

## 18. Resultado post-fix

Resultado: **PASS CON OBSERVACIONES**.

Las brechas reales detectadas en QA fueron corregidas y validadas con tokens reales o requests sin auth.

| Check | Rol | Esperado | Real | Estado |
|---|---|---:|---:|---|
| `/api/products?branchId=<branch_no_asignada>` | USER | 403 | 403 | PASS |
| `/api/products?branchId=<branch_no_asignada>` | ADMIN | 403 | 403 | PASS |
| `/api/products?branchId=<branch_asignada>` | USER | 200 | 200 | PASS |
| `/api/products?branchId=<branch_asignada>` | ADMIN | 200 | 200 | PASS |
| `/api/roles` | SUPER_USER | 403 | 403 | PASS |
| `/api/tenants?tenantId=<tenant_ajeno>` | SUPER_USER | 403 | 403 | PASS |
| `/api/reports/pos-sales` en reporteria | SUPER_ADMIN | 200 | 200 | PASS |
| `/api/reports/pos-sales` en reporteria | SUPER_USER | 200 | 200 | PASS |
| `/api/reports/pos-sales` en reporteria | ADMIN | 200 | 200 | PASS |
| `/api/reports/pos-sales` en reporteria | USER | 403 | 403 | PASS |
| `/api/reports/pos-sales` en reporteria sin auth | ANON | 401 | 401 | PASS |

Observaciones pendientes:

- QA visual en navegador sigue pendiente por fallo del Browser plugin local.
- Acciones destructivas siguen pendientes de fixture con rollback.
- DB multi-tenant real sigue pendiente porque el ambiente probado usa tenant `default`.

## 19. Re-QA final de cierre

Fecha: 2026-06-12.
Ambiente: local, API `http://localhost:4020/api`, reporteria `http://localhost:4021/api`.
Tokens: JWT reales obtenidos por login local. No se documentan credenciales.
SQL: no se ejecuto SQL mutante ni cambios contra produccion.

### Resultado

**PASS CON OBSERVACIONES**.

### Casos revalidados

| Caso | Esperado | Real | Estado |
|---|---:|---:|---|
| `ADMIN GET /api/products?branchId=<branch_ajena>` | 403 | 403 | PASS |
| `USER GET /api/products?branchId=<branch_ajena>` | 403 | 403 | PASS |
| `ADMIN GET /api/products?branchId=<branch_asignada>` | 200 | 200 | PASS |
| `USER GET /api/products?branchId=<branch_asignada>` | 200 | 200 | PASS |
| `SUPER_USER GET /api/roles` | 403 | 403 | PASS |
| `ADMIN GET /api/roles` | 403 | 403 | PASS |
| `USER GET /api/roles` | 403 | 403 | PASS |
| `SUPER_ADMIN GET /api/roles` | 200 | 200 | PASS |
| `SUPER_USER GET /api/tenants?tenantId=<tenant_ajeno>` | 403 | 403 | PASS |
| `ADMIN GET /api/tenants?tenantId=<tenant_ajeno>` | 403 | 403 | PASS |
| `USER GET /api/tenants?tenantId=<tenant_ajeno>` | 403 | 403 | PASS |
| `SUPER_ADMIN GET /api/tenants?tenantId=<tenant_cualquiera>` | 200 | 200 | PASS |
| `GET /api/reports/pos-sales` sin JWT | 401 | 401 | PASS |
| `GET /api/reports/cash-closings` sin JWT | 401 | 401 | PASS |
| Reporteria con rol `USER` | 403 | 403 | PASS |
| Reporteria con `SUPER_ADMIN` | 200 | 200 | PASS |
| Reporteria con `SUPER_USER` | 200 | 200 | PASS |
| Reporteria con `ADMIN` | 200 | 200 | PASS |

### Frontend route permissions

| Ruta | Permiso esperado | Permiso aplicado | Estado |
|---|---|---|---|
| `/inventory/suppliers` | `INVENTORY_SUPPLIERS.read` | `MENU_KEYS.INVENTORY_SUPPLIERS`, `read` | PASS |
| `/inventory/products` | `INVENTORY_PRODUCTS.read` | `MENU_KEYS.INVENTORY_PRODUCTS`, `read` | PASS |
| `/inventory/purchases` | `INVENTORY_PURCHASES.read` | `MENU_KEYS.INVENTORY_PURCHASES`, `read` | PASS |
| `/orders` | `ORDERS.read` | `MENU_KEYS.ORDERS`, `read` | PASS |
| `/pos` | `pos.read` | `pos`, `read` | PASS |
| `/reports` | No existe como ruta Next; ruta real es `/reporteria` | `/reporteria(?:/.*)?` usa `reporteria`, `read` | PASS con observacion |
| `/settings/users` | No existe como ruta Next; ruta real es `/usuarios` | `/usuarios` usa `MENU_KEYS.CONFIG_USUARIOS`, `read` | PASS con observacion |
| `/settings/roles` | No existe como ruta Next; ruta real es `/roles` | `/roles` usa `MENU_KEYS.CONFIG_ROLES`, `read` | PASS con observacion |

Evidencia estatica frontend:

- `web/lib/route-permissions.ts` usa keys especificas para products, purchases, suppliers, orders, usuarios y roles.
- `web/app/[tenant]/layout.tsx` filtra menu con `getAllowedMenuItems`.
- `web/app/[tenant]/layout.tsx` bloquea URL directa con `getRoutePermissionRequirement` y `hasPermission`.
- `web/app/[tenant]/layout.tsx` bloquea tenant ajeno para roles distintos a `SUPER_ADMIN`.

### Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `openspec.cmd validate auditoria-accesos-roles --strict` | PASS |
| `git diff --check` | PASS con warnings CRLF/LF |
| `cd api && npx.cmd tsx --test src/modules/inventory/controllers/product.controller.spec.ts src/common/services/access-control.service.spec.ts src/common/guards/permissions.guard.spec.ts src/modules/branches/branches.service.spec.ts` | PASS, 19 tests |
| `cd backend-reporteria && npx.cmd tsx --test src/modules/auth/jwt-auth.guard.spec.ts src/modules/auth/report-authz.guard.spec.ts` | PASS, 9 tests |
| `cd api && npm.cmd run build` | PASS |
| `cd web && npm.cmd run lint` | PASS con warnings preexistentes |
| `cd web && npm.cmd run build` | PASS con warnings preexistentes |
| `cd backend-reporteria && npm.cmd run build:bin` | PASS con warnings `pkg` |

### Warnings no bloqueantes

- CRLF/LF.
- Hooks/img de Next.
- Warnings `pkg`.

### Conclusion

El re-QA final de cierre no encontro brechas bloqueantes nuevas. El change `auditoria-accesos-roles` queda listo para archivar con observaciones documentadas: QA visual en navegador y flujos destructivos con rollback siguen como deuda de una fase posterior.

## 20. Cierre post-archive

Fecha: 2026-06-12.
Change archivado: `auditoria-accesos-roles`.
Archivo de archive: `openspec/changes/archive/2026-06-12-auditoria-accesos-roles/`.
Spec sincronizada: `openspec/specs/access-role-audit/spec.md`.

### Validaciones post-archive

| Comando | Resultado |
|---|---|
| `openspec.cmd validate --changes --strict` | PASS, 7 changes passed, 0 failed |
| `openspec.cmd validate --specs --strict` | FAIL global, `spec/access-role-audit` PASS y 4 specs fuera del change fallan |
| `git diff --check` | PASS con warnings CRLF/LF |

Specs con fallo fuera de `auditoria-accesos-roles`:

- `spec/inventario`
- `spec/precios`
- `spec/productos`
- `spec/reporteria-inventario`

### Resultado post-archive

**PASS CON OBSERVACIONES** para el cierre de `auditoria-accesos-roles`.

El archive se completo, la spec nueva `access-role-audit` valida correctamente y los changes activos validan en modo strict. El fallo de `openspec.cmd validate --specs --strict` queda documentado como deuda separada de specs existentes que no pertenecen a este change.
