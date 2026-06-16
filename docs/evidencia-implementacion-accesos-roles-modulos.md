# Evidencia implementacion accesos roles y modulos

Fecha: 2026-06-12

## Resumen ejecutivo

Se implemento una primera fase real de hardening de accesos por rol/modulo.

Cambios clave:

- `SUPER_ADMIN` queda como unico rol global real para tenants/sucursales.
- `SUPER_USER` queda limitado a su tenant para tenants y branches.
- `ADMIN` y `USER` quedan limitados a sucursales asignadas en branch listing/detail.
- Endpoint legacy `/api/permissions/menu` ya no es publico; requiere `SUPER_ADMIN`.
- `/api/me/menu` y `/api/me/permissions` usan `JwtAuthGuard`.
- Frontend deja de tratar `ADMIN` como privilegiado global.
- Frontend agrega helpers centrales para modulo/accion/menu.
- Frontend agrega reglas de ruta para finance, reporteria y seleccion de contexto POS.
- Se agrega SQL de auditoria read-only.
- Se agrega SQL idempotente de permisos base por rol/modulo.
- Se agrega evidencia y tests backend del scope central.
- Fase post-QA corrige branch scope en productos, roles globales, tenantId ajeno, reporteria mock auth y rutas frontend con permisos amplios.

## Matriz oficial de permisos

| Modulo | Accion | SUPER_ADMIN | SUPER_USER | ADMIN | USER |
|---|---|---|---|---|---|
| Tenants | READ_GLOBAL | Si | No | No | No |
| Tenants | READ_OWN | Si | Si | No | No |
| Branches | READ_GLOBAL | Si | No | No | No |
| Branches | READ_TENANT | Si | Si | No | No |
| Branches | READ_ASSIGNED | Si | Si | Si | Si |
| POS | READ/CREATE | Si | Si | Si | Si |
| POS | CANCEL | Si | Si | Si | No/permiso |
| Orders | READ/CREATE/UPDATE | Si | Si | Si | Si/permiso |
| Orders | CANCEL | Si | Si | Si | No/permiso |
| Purchases | READ | Si | Si | Si | Si/permiso |
| Purchases | CREATE/RECEIVE | Si | Si | Si | No/permiso |
| Inventory | READ | Si | Si | Si | Si limitado |
| Inventory | WRITE/ADJUST | Si | Si | Si | No |
| Reports | READ_GLOBAL | Si | No | No | No |
| Reports | READ_TENANT | Si | Si | No/limitado | No |
| Reports | READ_BRANCH | Si | Si | Si | No/limitado |
| Settings | READ/WRITE | Si | Si limitado | No | No |
| Users | MANAGE | Si | Si limitado por tenant | No | No |
| Roles | MANAGE | Si | No | No | No |
| Menus | MANAGE | Si | No | No | No |
| Payment Methods | MANAGE | Si | Si | No | No |
| Peripherals | MANAGE | Si | Si/permiso | Admin/permiso | No |
| Fiscal FE | READ | Si | Si | Si | Si |
| Fiscal FE | WRITE | Si | Si | Si | No |

## Inventario de modulos

Ver `docs/evidencia-auditoria-accesos-roles-modulos.md`.

## Inventario de endpoints

Ver tabla de endpoints en `docs/evidencia-auditoria-accesos-roles-modulos.md`.

## Inventario de rutas frontend

Ver tabla de rutas en `docs/evidencia-auditoria-accesos-roles-modulos.md`.

## Cambios backend

| Archivo | Cambio |
|---|---|
| `api/src/common/services/access-control.service.ts` | Agrega utilidades `canAccessTenant`, `resolveTenantId`, `getAccessibleBranchIds`, `canAccessBranch` |
| `api/src/modules/branches/branches.service.ts` | Corrige `SUPER_USER` no global; filtra `ADMIN`/`USER` por sucursales asignadas; rechaza tenantId ajeno |
| `api/src/modules/branches/branches.repository.ts` | Agrega `listByIds` para branch scope |
| `api/src/modules/tenants/tenants.controller.ts` | `SUPER_USER` lista solo su tenant |
| `api/src/modules/tenants/tenants.service.ts` | `listTenants(tenantId)` soporta filtro |
| `api/src/modules/permissions/permissions.controller.ts` | Protege `/permissions/menu` con JWT + `SUPER_ADMIN` |
| `api/src/modules/menu/menu.controller.ts` | Protege `/me/menu` y `/me/permissions` con `JwtAuthGuard` |
| `api/src/modules/inventory/controllers/unit.controller.ts` | Agrega `RolesGuard` + `PermissionsGuard` con `INVENTORY` |
| `api/src/modules/inventory/controllers/tax.controller.ts` | Agrega `RolesGuard` + `PermissionsGuard` con `INVENTORY` |
| `api/src/modules/inventory/controllers/customer.controller.ts` | Agrega `RolesGuard` + `PermissionsGuard` con `CUSTOMERS` |
| `api/src/modules/inventory/controllers/supplier.controller.ts` | Agrega `RolesGuard` + `PermissionsGuard` con `INVENTORY_SUPPLIERS` |
| `api/src/modules/pos-user-sessions/pos-user-sessions.controller.ts` | Agrega `RolesGuard` + `PermissionsGuard` con `POS` |
| `api/src/modules/inventory/controllers/stock-adjustment.controller.ts` | Agrega `PermissionsGuard`; permite `ADMIN`; mantiene `USER` excluido |
| `api/src/modules/inventory/controllers/product.controller.ts` | Valida `branchId` con `AccessControlService.canAccessBranch` antes de listar productos |
| `api/src/modules/roles/roles.controller.ts` | Restringe listado de roles a `SUPER_ADMIN` |
| `api/src/modules/tenants/tenants.controller.ts` | Rechaza `tenantId` ajeno para `SUPER_USER` |
| `backend-reporteria/src/modules/auth/jwt-auth.guard.ts` | Requiere JWT por defecto; mock auth solo con `REPORTS_ALLOW_MOCK_AUTH=true` |
| `backend-reporteria/src/modules/auth/report-authz.guard.ts` | Bloquea `USER` en reportes |

## Cambios frontend

| Archivo | Cambio |
|---|---|
| `web/lib/permissions.ts` | `ADMIN` ya no es bypass global; agrega `canPerformAction`, `canAccessModule`, `getAllowedMenuItems` |
| `web/components/auth/Can.tsx` | Agrega `<Can module action>` y `useCan` |
| `web/lib/route-permissions.ts` | Agrega proteccion central para `/pos/select-context`, `/finance/*`, `/reporteria/*` y usa keys especificas en products, purchases, suppliers, orders y customers |
| `web/app/[tenant]/layout.tsx` | Filtra menu con `getAllowedMenuItems`; bloquea URL de tenant ajeno para roles no `SUPER_ADMIN` |

## Cambios SQL

| Archivo | Tipo | Descripcion |
|---|---|---|
| `scripts/database/audit/access-control-audit.sql` | Auditoria | SELECT-only para roles, usuarios, branches, menus, permisos y brechas |
| `scripts/database/security/20260612_0039_access_roles_modules_permissions.sql` | Idempotente | Inserta permisos faltantes por rol/modulo; no borra ni reduce permisos |

## Tests ejecutados

- `openspec.cmd validate auditoria-accesos-roles --strict`: PASS
- `git diff --check`: PASS, solo warnings de LF/CRLF
- `cd api && npx tsx --test src/common/services/access-control.service.spec.ts`: PASS, 5 tests
- `cd api && npx tsx --test src/common/guards/permissions.guard.spec.ts`: PASS, 9 tests
- `cd api && npx tsx --test src/modules/branches/branches.service.spec.ts`: PASS, 3 tests
- `cd api && npx tsx --test src/modules/inventory/controllers/product.controller.spec.ts`: PASS, 2 tests
- `cd backend-reporteria && npx tsx --test src/modules/auth/jwt-auth.guard.spec.ts src/modules/auth/report-authz.guard.spec.ts`: PASS, 9 tests
- QA runtime post-fix con tokens reales: branch ajena, roles, tenant ajeno y reporteria: PASS
- `cd api && npm run build`: PASS
- `cd web && npm run lint`: PASS con warnings existentes de hooks/img
- `cd web && npm run build`: PASS con warnings existentes de hooks/img y Browserslist
- `cd backend-reporteria && npm run build`: PASS
- `rg -n "^\\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\\b" scripts/database/audit/access-control-audit.sql`: sin matches

## QA manual minimo

| Rol | Ruta/Modulo | Accion | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|
| SUPER_ADMIN | Tenants | Listar todos | Permitido | Pendiente QA | Pendiente |
| SUPER_ADMIN | Branches | Listar todos | Permitido | Pendiente QA | Pendiente |
| SUPER_USER | Tenants | Listar | Solo tenant propio | Pendiente QA | Pendiente |
| SUPER_USER | Branches | Listar | Branches del tenant propio | Pendiente QA | Pendiente |
| ADMIN | Branches | Listar | Solo branches asignadas | Pendiente QA | Pendiente |
| USER | Branches | Listar | Solo branch/contexto asignado | Pendiente QA | Pendiente |
| USER | `/configuracion` URL directa | Entrar | Bloqueado | Pendiente QA | Pendiente |
| USER | `/roles` URL directa | Entrar | Bloqueado | Pendiente QA | Pendiente |
| USER | POS | Crear venta | Permitido si tiene permiso | Pendiente QA | Pendiente |
| USER | Caja | Abrir/cerrar | Permitido segun permiso/contexto | Pendiente QA | Pendiente |
| ADMIN | Reporteria | Ver branch | Permitido en scope | Pendiente QA | Pendiente |
| SUPER_USER | Reporteria | Ver tenant | Permitido tenant propio | Pendiente QA | Pendiente |
| SUPER_ADMIN | Reporteria | Ver global | Permitido | Pendiente QA | Pendiente |

## Riesgos pendientes

- `backend-reporteria` permite mock auth por defecto. QA/PRD debe definir `REPORTS_ALLOW_MOCK_AUTH=false`.
- Revisar endpoints restantes con permisos de modulo genericos para agregar action-level mas fino en una fase posterior.
- El SQL idempotente no reduce permisos existentes. Si hay permisos demasiado amplios, deben revisarse con evidencia y pruebas antes de recortar.
- Frontend no tiene suite formal detectada; queda checklist manual.

## Recomendaciones siguiente fase

- Crear suite e2e por rol contra endpoints criticos.
- Migrar controllers JWT-only a `RolesGuard` + `PermissionsGuard` donde aplique.
- Forzar `REPORTS_ALLOW_MOCK_AUTH=false` en plantillas QA/PRD.
- Normalizar `MENU_KEYS` compartidos backend/frontend.
- Agregar auditoria de intentos cross-tenant/cross-branch.

## Cierre post-archive

El change `auditoria-accesos-roles` fue archivado el 2026-06-12 en `openspec/changes/archive/2026-06-12-auditoria-accesos-roles/`.

La delta spec fue sincronizada en `openspec/specs/access-role-audit/spec.md`.

Validaciones post-archive:

| Comando | Resultado |
|---|---|
| `openspec.cmd validate --changes --strict` | PASS, 7 changes passed, 0 failed |
| `openspec.cmd validate --specs --strict` | FAIL global: `spec/access-role-audit` PASS; fallan `spec/inventario`, `spec/precios`, `spec/productos`, `spec/reporteria-inventario` |
| `git diff --check` | PASS con warnings CRLF/LF |

Resultado de cierre: **PASS CON OBSERVACIONES**. La observacion no bloquea el archive de `auditoria-accesos-roles`; requiere seguimiento separado sobre specs existentes fuera de este change.
