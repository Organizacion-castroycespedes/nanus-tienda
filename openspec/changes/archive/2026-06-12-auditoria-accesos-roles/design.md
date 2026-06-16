## Context

El control de acceso actual esta repartido en varias capas:

- Base de datos y seeds: `roles`, `user_roles`, `permissions`, `menu_items`, `role_menu_permissions`, `scripts/database/003_seed_roles.sql`, `scripts/database/007_seed_role_menu_permissions.sql` y migraciones posteriores.
- Backend API principal: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `AccessControlService`, `FinanceAuthzGuard`, `@Roles` y `@RequirePermission`.
- Backend de reporteria: `backend-reporteria/src/modules/auth/jwt-auth.guard.ts` y `ReportAuthzGuard`.
- Frontend: menu dinamico, `web/lib/route-permissions.ts`, `web/lib/permissions.ts`, permisos propios de finanzas/reporteria y checks directos por rol en paginas.

Hallazgos iniciales de orientacion, pendientes de confirmacion completa durante la auditoria:

- Roles base sembrados: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER`.
- El API principal ya valida JWT y sesion en `api/src/common/guards/jwt-auth.guard.ts`.
- `PermissionsGuard` tiene atajos para `SUPER_ADMIN` y para `SUPER_USER` en algunos menus de configuracion.
- Frontend trata `SUPER_ADMIN` y `ADMIN` como roles privilegiados en `web/lib/permissions.ts`, mientras backend no usa el mismo atajo global para `ADMIN`.
- Backend y frontend no tienen el mismo set de `MENU_KEYS`; backend incluye claves de facturacion electronica que frontend no declara.
- `backend-reporteria` permite mock auth por defecto si `REPORTS_ALLOW_MOCK_AUTH` no es `false`.
- Hay endpoints publicos o parcialmente protegidos que deben clasificarse explicitamente, por ejemplo `system/version`, `permissions/menu`, endpoints con solo `JwtAuthGuard`, y rutas de reporteria/finanzas con guards propios.

La fase inicial produce evidencia. La fase 2 implementa controles reales y mantiene el backend como frontera de seguridad.

## Goals / Non-Goals

**Goals:**

- Inventariar roles existentes y usuarios asociados por tenant/sucursal.
- Inventariar modulos, menus, permisos READ/WRITE/actions y rutas visibles por rol.
- Inventariar rutas frontend reales y mecanismo de proteccion aplicado.
- Inventariar endpoints backend reales, guards, roles permitidos, permisos requeridos y controles manuales por servicio.
- Comparar configuracion DB/seeds contra reglas aplicadas en codigo.
- Identificar riesgos e inconsistencias con severidad, evidencia y recomendacion.
- Dejar un reporte reproducible en `docs/security/access-role-audit.md`.
- Aplicar reglas oficiales para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y `USER` en DB, backend, frontend, menu, rutas y acciones.
- Validar alcance por tenant y sucursal para endpoints sensibles.
- Agregar pruebas y evidencia tecnica de implementacion.

**Non-Goals:**

- No tocar produccion.
- No borrar permisos existentes sin evidencia y autorizacion.
- No cambiar nombres de roles oficiales.
- No hacer refactor masivo ajeno al control de accesos.

## Decisions

### Decision: Separar acceso configurado, visible y efectivo

La auditoria tendra tres matrices distintas:

- Configurado: lo que existe en DB, seeds y migraciones.
- Visible: lo que el frontend muestra o permite navegar.
- Efectivo backend: lo que el backend acepta por guards, decoradores y validaciones de servicio.

Razon: el frontend no es frontera de seguridad. Mezclar menu visible con endpoint permitido esconderia fallas reales.

Alternativa considerada: una sola matriz por rol. Se descarta porque perderia diferencias entre UI, DB y API.

### Decision: Backend como autoridad de seguridad

Las recomendaciones deben priorizar brechas donde backend permite mas de lo que DB/UI sugieren. Las brechas solo-frontend se reportan como UX o exposicion de navegacion, no como autorizacion fuerte.

Alternativa considerada: tratar frontend y backend con el mismo peso. Se descarta porque un usuario puede llamar endpoints sin pasar por la UI.

### Decision: Extraccion reproducible y de solo lectura

La implementacion de la auditoria puede agregar consultas o scripts de lectura para extraer inventarios, pero no debe ejecutar `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP` ni cambios funcionales.

Alternativa considerada: inspeccion manual sin scripts. Se descarta porque el resultado seria dificil de repetir en QA/PRD.

### Decision: Incluir servicios con autorizacion propia

Finanzas, reporteria, inventario, menu admin y usuarios tienen reglas que no viven solo en decorators. La auditoria debe leer controllers y servicios para detectar validaciones por tenant, branch, terminal, rol y acciones especiales.

Alternativa considerada: auditar solo decorators. Se descarta porque dejaria huecos en permisos reales.

### Decision: Reporte accionable, no correccion automatica

Cada hallazgo debe tener evidencia, impacto, severidad y recomendacion. Las correcciones cubiertas por la fase 2 se aplican en este change; cambios mayores no cubiertos quedan para seguimiento.

Alternativa considerada: arreglar hallazgos durante la auditoria. Se descarta por alcance y riesgo.

### Decision: Modelo oficial por alcance

El modelo oficial se expresa por alcance:

- `SUPER_ADMIN`: acceso global multi-tenant y multi-sucursal, con seleccion de contexto operativo cuando una operacion lo requiera.
- `SUPER_USER`: acceso amplio dentro de su tenant y todas sus sucursales.
- `ADMIN`: acceso administrativo operativo dentro de su tenant y sucursales asignadas.
- `USER`: acceso operativo basico dentro de su tenant y sucursal/contexto operativo asignado.

Razon: el mismo modulo puede permitir acciones distintas segun alcance tenant/branch, no solo por rol.

Alternativa considerada: un rol minimo por endpoint. Se descarta como unica regla porque no protege branch scope.

### Decision: Helpers compartidos para frontend

Frontend debe usar helpers centralizados `canPerformAction`, `canAccessModule`, `getAllowedMenuItems`, `useCan` y `<Can>` para reducir checks dispersos por rol.

Alternativa considerada: dejar checks directos por pagina. Se descarta porque ya hay divergencia entre helpers, menu y rutas.

## Risks / Trade-offs

- Runtime DB no disponible -> usar seeds/migraciones como configuracion esperada y marcar la falta de evidencia runtime.
- Menus son tenant-specific -> reporte debe indicar tenant analizado y no asumir que todos los tenants son iguales.
- Reglas por servicio pueden ser dificiles de detectar automaticamente -> combinar extraccion automatica con revision manual de archivos criticos.
- Mock auth en reporteria puede ser necesario en dev -> recomendacion debe distinguir DEV/QA/PRD y no romper flujo local.
- Roles custom pueden existir en DB -> reporte debe listarlos y separarlos de roles base.
- Acciones JSON de `role_menu_permissions.actions` pueden diferir por migracion -> reporte debe mostrar acciones por menu, no solo READ/WRITE.
- Endurecer rutas puede bloquear flujos existentes -> aplicar cambios por helpers reutilizables y cubrir con tests donde exista infraestructura.

## Migration Plan

1. Crear scripts/consultas de auditoria de solo lectura.
2. Generar documentos de evidencia.
3. Aplicar helpers y guards de alcance con cambios pequenos.
4. Agregar migracion/seed idempotente solo si faltan permisos configurados.
5. Validar OpenSpec, diff, tests y builds disponibles.
6. Para rollback, revertir archivos del change y no ejecutar scripts idempotentes pendientes.

## Open Questions

- Cual base se usara como evidencia runtime: local, QA AWS o dump especifico?
- Deben incluirse usuarios demo/fixtures en la matriz formal o solo usuarios reales del tenant Castro & Cespedes?
- El reporte debe cubrir todos los tenants o solo el tenant operativo principal?
- Se desea export CSV/JSON ademas del Markdown final?
