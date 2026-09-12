# Evidencia: Gestión Operativa — arquitectura y alcance

## Decisión

Este documento define diseño. No hay código de producción implementado.

Gestión Operativa complementa la operación de facturación electrónica. No es
requisito para cerrar la certificación del core FE.

## Arquitectura actual

- JWT, sesión activa y contexto POS/caja: `api/src/common/guards/jwt-auth.guard.ts`.
- Roles: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER` en guards, JWT y DB.
- Permisos/menu: `api/src/common/guards/permissions.guard.ts`,
  `api/src/common/services/access-control.service.ts`,
  `api/src/common/constants/menu-keys.ts` y `web/lib/route-permissions.ts`.
- POS context: `api/src/modules/pos-user-sessions/` y `web/domains/pos/`.
- Caja: `api/src/modules/finance/cash-sessions/` y `cash_sessions`.
- Ventas: `api/src/modules/inventory/controllers/sale.controller.ts`,
  `sale.service.ts`, `sale.repository.ts` y `sale.entity.ts`.
- Reportes/tickets: `backend-reporteria/src/modules/reports/` y
  `web/modules/reporteria/`.
- Auditoría: `auditoria_eventos` y `security_audit_logs`.

## Matriz objetivo

| Rol | Tenant | Branch | Shift | Visibilidad |
|---|---|---|---|---|
| `USER` | JWT | contexto/asignada | `OPEN` actual | ventas del turno |
| `ADMIN` | JWT | autorizada | no requerido | ventas administrativas |
| `SUPER_USER` | JWT | branches del tenant | no requerido | ventas autorizadas del tenant |
| `SUPER_ADMIN` | política global actual | política global actual | por operación | contexto autorizado |

`current shift` debe salir del backend. Sin turno, turno cerrado o múltiples
sesiones inconsistentes: acceso operativo denegado de forma accionable.

## Datos y DB

`sales` ya contiene tenant, branch, usuario y sesión POS. La caja se relaciona
por `cash_sessions` y pagos; no se debe inventar una columna directa de venta.
Índices relevantes ya existen para tenant/branch/status, pagos y sesiones.
No se propone migración en esta fase.

## MVP y futuro

MVP: lista paginada, detalle, filtros, scope backend, aislamiento tenant/
branch/shift, estado FE, errores útiles y navegación fiscal del cliente.

Post-MVP: cancelación/void avanzada, devoluciones, incidencias, conciliación
operativa, configuración UI, acciones FE adicionales y nuevos submódulos.

Fuera de alcance: auth paralela, borrar ventas fiscales, retransmitir DIAN,
duplicar electronic billing o activar workers.

## OpenSpec

Se creó `incorporar-modulo-gestion-operativa`. Se reutilizan y no se duplican
los cambios existentes `gestion-operativa-turno-caja-actual`,
`mejoras-funcionales-operativas-caja-roles-menu` y
`ajustar-permisos-operativos-clientes-pedidos-pos-inventario`.

## Dependencias

1. Política real de acceso y auditoría.
2. API de ventas y consultas de reporteria.
3. POS/caja/contexto.
4. Read model del dominio FE.
5. Navegación y permisos menu.

## Riesgos

- Scope confiado al frontend: mitigado calculándolo en backend.
- N+1 de FE: mitigado con read model batch.
- Admin bloqueado por falta de turno: separado del flujo POS.
- Datos de turno ausentes en venta: usar pagos/caja, no fechas.
- Acceso global accidental: no crear bypass nuevo.
