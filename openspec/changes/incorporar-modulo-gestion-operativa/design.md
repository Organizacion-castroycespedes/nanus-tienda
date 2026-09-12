# Diseño: Gestión Operativa

## Arquitectura actual observada

- Auth: `api/src/common/guards/jwt-auth.guard.ts` valida Bearer JWT, sesión
  activa, `tenant_id`, roles y contexto POS/caja.
- Roles y permisos: `api/src/common/guards/roles.guard.ts`,
  `api/src/common/guards/permissions.guard.ts`,
  `api/src/common/services/access-control.service.ts` y
  `api/src/common/decorators/require-permission.decorator.ts`.
- Tenant/branch: `tenants`, `tenant_branches`, `users` y
  `persona_tenant_branches`; `AccessControlService` resuelve branches
  accesibles dentro del tenant.
- POS: `api/src/modules/pos-user-sessions/` y `web/domains/pos/`; el contexto
  contiene `tenantId`, `branchId`, `terminalId`, `posSessionId` y sesión auth.
- Caja: `api/src/modules/finance/cash-sessions/`; estados `OPEN`, `CLOSED` y
  `CANCELLED`. `cash_sessions` relaciona tenant, branch y usuario que abrió.
- Ventas: `api/src/modules/inventory/entities/sale.entity.ts`,
  `api/src/modules/inventory/services/sale.service.ts`,
  `api/src/modules/inventory/repositories/sale.repository.ts` y
  `api/src/modules/inventory/controllers/sale.controller.ts`.
- Reportes/UI: `backend-reporteria/src/modules/reports/sales-reports.*`,
  `web/modules/reporteria/components/PosReportsPage.tsx` y
  `web/modules/reporteria/services/reporting.service.ts`.
- FE: el módulo operativo solo lee/referencia el estado y los identificadores
  del dominio `electronic-billing`.

## Roles reales y alcance objetivo

| ROLE | TECHNICAL ROLE | TENANT | BRANCH | SHIFT | SALE VISIBILITY |
|---|---|---|---|---|---|
| Operational user | `USER` | JWT tenant | contexto/branch asignado | turno `OPEN` actual resuelto backend | ventas del turno actual |
| Admin | `ADMIN` | JWT tenant | branches asignadas | sin requisito de turno para consulta administrativa | ventas autorizadas de branch |
| Super user | `SUPER_USER` | JWT tenant | branches activas del tenant | sin restricción de turno | ventas del tenant en branches autorizadas |
| Super admin | `SUPER_ADMIN` | política global existente | según política global | según operación existente | solo contexto global autorizado |

`SUPER_ADMIN` no recibe un acceso global nuevo. La selección de tenant,
impersonation y auditoría deben seguir las capacidades existentes.

## Política central propuesta

```text
actor <- JWT + auth session + POS/cash context
scope <- resolveOperationalScope(actor, requestedOperation)
query <- salesRepository.findOperationalSales(scope, filters)
```

El frontend no define el scope. `tenantId`, `branchId` y `cashSessionId`
recibidos del cliente son sugerencias sujetas a validación; nunca sustituyen
el scope calculado.

Para `USER`, `current shift` significa la única sesión de caja `OPEN` que
coincide con actor, tenant y branch/contexto. Sin sesión, sesión cerrada o
más de una sesión inconsistente: denegar consulta operativa y devolver estado
accionable. `ADMIN` no pasa por esta condición.

## API futura

`OperationalSalesController` debe exponer lista y detalle. El servicio
calcula scope y el repositorio recibe únicamente `OperationalSaleScope`.

Filtros: fechas, status, user, branch, cash session, payment method, estado
FE, número fiscal y customer. La respuesta usa DTOs paginados con `items`,
`page`, `pageSize`, `total`, `sort` y filtros normalizados. Orden default:
`created_at DESC, id DESC`.

La lista usa un read model liviano. El detalle carga productos, pagos, caja,
usuario/terminal y un resumen FE. No hace llamadas por fila a FactuCore.

## Acciones

| ACTION | TODAY | MVP | POLICY |
|---|---|---|---|
| VIEW / VIEW_DETAIL | POS/reporteria existentes | Sí | scope backend |
| FILTER / REFRESH | parcial, sin paginación completa | Sí | query server-side |
| FE status | parcial en reporteria | Sí | solo lectura del dominio FE |
| REFRESH STATUS | dominio FE existente | Futuro coordinado | permiso y acción explícita |
| RETRY technical error | no seguro por defecto | Futuro | no retransmitir terminal |
| CANCEL | `POST /sales/:id/cancel` | Fuera del primer slice | mantener caja abierta y permiso actuales |
| VOID / RETURN | no como contrato único | Futuro | definir dominio separado |
| DELETE | no exponer | Prohibido | ventas fiscales son históricas |

## UI futura

Phase 3 decision: the implemented route is `/{tenant}/operations/sales`.
The dynamic menu uses `OPERATIONS` and `OPERATIONS_SALES`; navigation reuses
the existing POS read permission while backend access remains authoritative.

Ruta recomendada: `/{tenant}/operations/sales`, solo si no contradice el
router actual. Menú `Gestión Operativa` requiere un menu key/permisos
comparados contra la convención real; ocultar menú no reemplaza guards.

Lista: fecha, estado operativo, estado FE, cliente, usuario, branch, turno,
total y acciones autorizadas. Detalle: resumen, cliente, productos, pago,
caja/turno, usuario/terminal, FE y auditoría/estado.

Web y Electron comparten API, DTOs, permisos y reglas. Cada cliente puede
adaptar layout y usar su bridge existente, sin duplicar autorización.

## FE integration

Mostrar estado Manus, estado proveedor, número fiscal, CUFE, timestamps y
error normalizado cuando existan. No mostrar SOAP, secretos, credenciales ni
PII innecesaria. No editar snapshots. No crear reconciliación paralela.

## DB y performance

El modelo actual contiene `tenant_id`, `branch_id`, `user_id` y
`pos_session_id` en `sales`; `cash_session_id` está en pagos/caja y no es una
columna directa garantizada de venta. La relación de turno debe usar la
relación financiera existente, no inferencia por fecha.

Índices ya observados: `idx_sales_tenant_branch_status`,
`idx_sales_payment_status`, índices de `cash_sessions` por tenant/branch/
status/created_at y `idx_persona_branches_tenant`. Primero medir la query
real; no se propone migración ahora. Un índice compuesto adicional solo se
justifica con `EXPLAIN` de la consulta paginada.

## Auditoría

Reusar `auditoria_eventos`/`security_audit_logs` y sus índices por tenant y
fecha. Registrar actor, acción, tenant, branch y venta; nunca ticket completo,
SOAP, secretos ni payload fiscal innecesario.

## Dependencias y orden

1. `access-role-audit`, `mejora-contexto-operativo-perfiles`.
2. `gestion-operativa-turno-caja-actual` y `mejoras-funcionales-operativas-caja-roles-menu`.
3. Sale API/repository y reporteria POS.
4. `completar-ciclo-facturacion-electronica-dian` para lectura FE.
5. Clientes, branches, cash sessions, menu y permisos.

Gestión Operativa no es requisito para certificar el core FE. FE core puede
cerrar primero; este módulo complementa su operación posterior.

## Fases propuestas

1. Política RBAC/scope y tests de aislamiento.
2. API de ventas operativas paginada.
3. Medición e índices solo si son necesarios.
4. Shell frontend y navegación protegida.
5. Lista/filtros.
6. Detalle.
7. Visibilidad FE y acciones seguras.
8. Auditoría, permisos y matriz QA.

## Riesgos

- Filtro frontend pueda ampliar scope: resolver scope exclusivamente en backend.
- `USER` consulte histórico: requerir sesión `OPEN` actual.
- `ADMIN` quede bloqueado sin turno: separar API administrativa de POS.
- `cash_session_id` no exista en venta: relacionar por pagos, sin adivinar.
- UI duplique FE: usar read model y contratos del módulo FE.
- Cambio global accidental: validar cada tenant/context switch.
- N+1 en lista: read model batch y sin proveedor por fila.
