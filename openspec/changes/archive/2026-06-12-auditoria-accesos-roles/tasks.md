## 1. Evidence Setup

- [x] 1.1 Confirm audit evidence source: local DB, QA AWS DB, dump, or repository-only fallback.
- [x] 1.2 Create `docs/security/access-role-audit.md` with sections for scope, evidence, matrices, findings and recommendations.
- [x] 1.3 Define read-only SQL queries for roles, users, tenants, branches, menu items, role menu permissions, legacy permissions and action permissions.
- [x] 1.4 Add optional read-only extraction helper if needed, with guards that reject mutating SQL.

## 2. Repository Inventory

- [x] 2.1 Inventory seeded roles and expected permissions from `api/database/` and `scripts/database/`.
- [x] 2.2 Inventory backend menu keys, aliases and permission constants from `api/src/common/constants/menu-keys.ts`.
- [x] 2.3 Inventory frontend menu keys, aliases and route permission rules from `web/domains/menu/constants.ts` and `web/lib/route-permissions.ts`.
- [x] 2.4 Inventory frontend pages under `web/app`, including tenant routes, finance routes, reporteria routes and public routes.
- [x] 2.5 Inventory backend controllers under `api/src/modules`, including method, path, guards, roles and required permissions.
- [x] 2.6 Inventory reporting controllers and auth guards under `backend-reporteria/src/modules`.
- [x] 2.7 Inventory service-level authorization checks in users, tenants, terminals, finance, inventory, menu admin and report services.

## 3. Runtime Or Seed Data Inventory

- [x] 3.1 Extract or document roles and role descriptions.
- [x] 3.2 Extract or document users grouped by role, tenant, branch and status.
- [x] 3.3 Extract or document modules and menu items by tenant, key, module, route, visibility and parent.
- [x] 3.4 Extract or document role menu permissions by role, menu item, access level and actions JSON.
- [x] 3.5 Compare legacy `permissions` rows/seeds with `menu_items` and `role_menu_permissions`.

## 4. Effective Access Matrices

- [x] 4.1 Build role-to-module matrix with READ, WRITE and action-level permissions.
- [x] 4.2 Build role-to-menu visibility matrix by tenant.
- [x] 4.3 Build role-to-frontend-route matrix with protection source and route coverage status.
- [x] 4.4 Build role-to-backend-endpoint matrix with guards, decorators, permissions and service-level constraints.
- [x] 4.5 Build separate finance and reporteria access summaries because both domains have their own authorization helpers.

## 5. Discrepancies And Risks

- [x] 5.1 Compare backend constants, frontend constants, DB menu keys and decorators for missing or divergent menu keys.
- [x] 5.2 Compare frontend role shortcuts against backend effective access for the same modules.
- [x] 5.3 Flag endpoints with public, JWT-only, role-only or mock-auth behavior.
- [x] 5.4 Flag DB-configured access that is not reachable from UI and code-granted access that is absent from DB.
- [x] 5.5 Write risk register with severity, affected role, evidence, impact and recommendation.

## 6. Validation And Handoff

- [x] 6.1 Confirm functional authorization changes are documented with evidence.
- [x] 6.2 Validate the final OpenSpec change with `openspec.cmd validate auditoria-accesos-roles --strict`.
- [x] 6.3 Review final diff for implementation scope plus audit/security SQL.
- [x] 6.4 Prepare follow-up OpenSpec recommendations for approved fixes after the audit is reviewed.

## 7. Fase 2 Implementación Real Del Control De Accesos

- [x] 7.1 Actualizar OpenSpec para permitir implementacion real sin perder evidencia de auditoria.
- [x] 7.2 Crear inventario real de roles, usuarios semilla, modulos, menus, rutas frontend, endpoints backend y permisos efectivos.
- [x] 7.3 Crear `docs/evidencia-auditoria-accesos-roles-modulos.md` con matrices esperada/real y brechas.
- [x] 7.4 Crear `scripts/database/audit/access-control-audit.sql` con SELECT unicamente para roles, usuarios, tenants, branches, menus, permisos y brechas.
- [x] 7.5 Definir matriz oficial de permisos por modulo y accion para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y `USER`.
- [x] 7.6 Crear seeds o migracion SQL idempotente si faltan permisos de menus/modulos, sin borrar permisos existentes.
- [x] 7.7 Centralizar autorizacion backend reutilizando guards/decoradores existentes y agregando utilidades de tenant/branch scope.
- [x] 7.8 Validar alcance backend por tenant y sucursal para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y `USER`.
- [x] 7.9 Auditar y proteger endpoints criticos de auth/session, users, roles, menus, tenants, branches, products, inventory, purchases, orders, POS sales, customers, suppliers, reports, cash, pricing, payment methods, settings, peripherals y fiscal.
- [x] 7.10 Centralizar permisos frontend para menu, rutas y acciones con helpers reutilizables.
- [x] 7.11 Bloquear rutas frontend directas no autorizadas y tenantId no autorizado.
- [x] 7.12 Controlar botones/acciones frontend como crear, editar, eliminar, cancelar, exportar, ajustar inventario, abrir/cerrar caja, usuarios, roles y configuracion.
- [x] 7.13 Crear o actualizar tests backend para acceso permitido y denegado por rol, tenant y branch.
- [x] 7.14 Agregar tests frontend si existe infraestructura; si no existe, documentar limitacion y checklist manual.
- [x] 7.15 Crear `docs/evidencia-implementacion-accesos-roles-modulos.md` con cambios, pruebas, QA, riesgos y recomendaciones.
- [x] 7.16 Ejecutar `openspec.cmd validate auditoria-accesos-roles --strict`, `git diff --check` y validaciones disponibles del proyecto.

## 8. Fase 3 Correccion De Brechas QA

- [x] 8.1 Bloquear branch scope en `GET /api/products?branchId=...` para `ADMIN` y `USER`.
- [x] 8.2 Restringir `GET /api/roles` a `SUPER_ADMIN`.
- [x] 8.3 Rechazar `tenantId` ajeno en `GET /api/tenants` para `SUPER_USER`.
- [x] 8.4 Cambiar reporteria para requerir JWT por defecto y permitir mock auth solo con `REPORTS_ALLOW_MOCK_AUTH=true`.
- [x] 8.5 Bloquear rol `USER` en endpoints de reporteria.
- [x] 8.6 Alinear rutas frontend sensibles con menu keys especificas.
- [x] 8.7 Agregar pruebas automatizadas para branch scope, reporteria JWT/mock y reporteria por rol.
- [x] 8.8 Actualizar evidencia QA con resultados post-fix.

## 9. Fase 4 Re-QA Final Y Cierre

- [x] 9.1 Revalidar branch scope de productos para branch asignada y ajena en `ADMIN` y `USER`.
- [x] 9.2 Revalidar restriccion de roles para `SUPER_USER`, `ADMIN`, `USER` y acceso de `SUPER_ADMIN`.
- [x] 9.3 Revalidar tenant scope de `/api/tenants?tenantId=...`.
- [x] 9.4 Revalidar reporteria sin JWT y reporteria por rol.
- [x] 9.5 Revisar alineacion focalizada de `web/lib/route-permissions.ts`.
- [x] 9.6 Consolidar evidencia final en `docs/evidencia-qa-accesos-roles-modulos.md`.
- [x] 9.7 Ejecutar validaciones finales de OpenSpec, diff, tests y builds disponibles.
