## Why

Manus POS tiene control de acceso distribuido entre base de datos, guards NestJS, servicios de dominio, rutas Next.js y helpers frontend. Hoy no existe un inventario formal que demuestre que los roles, menus, rutas y endpoints coinciden entre lo configurado y lo aplicado realmente.

Esta auditoria es necesaria antes de corregir permisos, porque cambiar accesos sin mapa completo puede abrir rutas indebidas o bloquear flujos operativos legitimos.

## What Changes

- Crear una auditoria tecnica de accesos por rol para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER` y cualquier rol adicional encontrado en base de datos o seeds.
- Inventariar roles, usuarios asociados, tenants, sucursales, modulos, menus, rutas frontend, endpoints backend y permisos efectivos por modulo.
- Comparar lo configurado en DB (`roles`, `user_roles`, `menu_items`, `role_menu_permissions`, `permissions` legado y seeds/migraciones) contra lo aplicado en codigo.
- Revisar reglas en backend: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `FinanceAuthzGuard`, `ReportAuthzGuard`, decoradores `@Roles`, `@RequirePermission`, validaciones manuales en servicios y endpoints sin guards.
- Revisar reglas en frontend: menu dinamico, `web/lib/route-permissions.ts`, `web/lib/permissions.ts`, helpers por dominio y checks directos por rol en paginas.
- Producir un reporte formal con brechas, riesgos, inconsistencias y recomendaciones priorizadas.
- Implementar una fase real de control de accesos por rol y modulo en base de datos, backend, frontend, menu lateral, rutas protegidas, filtros tenant/branch, acciones por modulo, pruebas y evidencia.
- Mantener la seguridad real en backend; frontend solo oculta navegacion y acciones como defensa adicional.

## Capabilities

### New Capabilities

- `access-role-audit`: auditoria e implementacion formal de roles, menus, rutas, endpoints y permisos efectivos, incluyendo comparacion DB versus codigo, enforcement real y recomendaciones de seguridad.

### Modified Capabilities

- Ninguna en esta propuesta. Esta capacidad transversal endurece controles de acceso sin cambiar reglas de negocio de venta, compra, POS, caja o inventario.

## Impact

- Afecta documentacion OpenSpec y un reporte tecnico bajo `docs/`.
- Analiza `api/`, `web/`, `backend-reporteria/`, `api/database/` y `scripts/database/`.
- Agrega SQL de auditoria de solo lectura y, si faltan permisos, scripts idempotentes de seguridad sin borrar permisos existentes.
- Puede modificar guards, helpers de autorizacion, proteccion de rutas, menu y pruebas, manteniendo cambios pequenos y trazables.
- No debe ejecutar cambios destructivos, tocar produccion ni incluir credenciales.
