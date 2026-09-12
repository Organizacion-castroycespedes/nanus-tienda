# Evidencia — Gestión Operativa Phase 1: Access Scope

## Estado

Implementado solo el núcleo backend de scope. No se implementó lista,
detalle ni UI de ventas.

## Modelo reutilizado

- `JwtAuthGuard` valida JWT, `tenant_id`, `auth_sessions` y contexto POS.
- `RolesGuard` conserva los roles `USER`, `ADMIN`, `SUPER_USER` y
  `SUPER_ADMIN`.
- `PermissionsGuard` y `AccessControlService` conservan permisos de menú y
  acceso por tenant/branch.
- `cash_sessions` conserva los estados `OPEN`, `CLOSED` y `CANCELLED`.

## Política central

`api/src/common/services/operational-sale-scope.service.ts` define
`OperationalSaleScopeService` y `OperationalSaleScope`.

- `USER`: tenant fijo, branch autorizada y exactamente una caja `OPEN` del
  usuario. Cero o múltiples sesiones fallan cerrado.
- `ADMIN`: tenant fijo y branch autorizada. No requiere turno abierto.
- `SUPER_USER`: tenant fijo y branches activas autorizadas del tenant.
- `SUPER_ADMIN`: conserva la política global existente; no se agregó bypass.

La consulta futura recibe el scope ya resuelto mediante
`OperationalSaleRepository`. Los filtros se aplican como intersección y no
pueden ampliar tenant, branch, caja ni usuario.

## Pruebas

Archivo: `api/src/common/services/operational-sale-scope.service.spec.ts`.

- Scope `USER` con una sesión abierta: permitido.
- Sin sesión abierta: denegado.
- Sesiones abiertas ambiguas: denegado.
- Venta de turno anterior: denegada.
- `ADMIN` sin turno: permitido en branch autorizada.
- `SUPER_USER` entre branches del mismo tenant: permitido.
- Tenant cruzado y branch no autorizada: denegados.
- Filtros manipulados: no amplían scope.
- Borrado fiscal: no permitido por la política.

Resultado combinado de pruebas focalizadas y regresión: `80/80 PASS`.
API build: `PASS`.

## Base de datos

No hay migraciones en Phase 1. Se reutilizan `sales.tenant_id`,
`sales.branch_id`, relación financiera existente, `cash_sessions` y
asignaciones `persona_tenant_branches`. La query paginada de Phase 2 debe
validarse con `EXPLAIN` antes de proponer índices.

## Permisos y FE

El servicio no reemplaza `PermissionsGuard` ni permisos de menú. Gestión
Operativa solo leerá estado FE desde el dominio de facturación electrónica;
ese dominio mantiene la fuente de verdad.

## Pendiente

Phase 2 debe implementar controller, servicio de ventas operativas, query
paginada, read model FE, filtros y pruebas de integración. La UI Web/Electron,
acciones FE y auditoría quedan fuera de este checkpoint.
