## Why

La operacion diaria de Manus POS necesita cerrar huecos funcionales alrededor de caja, tickets, contexto POS, post-login, permisos y menu por rol. Hoy existen piezas aisladas: cierre de caja, reporteria PDF, seleccion POS y menu RBAC, pero la experiencia no queda completamente alineada con el flujo operativo de Tienda Castro & Cespedes.

El cambio busca estabilizar el flujo local sin tocar produccion, sin desplegar y sin debilitar validaciones multi-tenant.

## What Changes

- Cierre de caja muestra `NoticeDialog` para exito y fallo.
- Cierre exitoso expone resumen operativo y acciones de ticket: ver, descargar e imprimir.
- `/finance/cash-sessions` agrega acciones de ticket para sesiones cerradas.
- Login normal redirige a `/{tenantId}/dashboard`.
- POS queda bloqueado o desactivado si no existe caja abierta.
- Apertura de caja pasa por `/{tenantId}/pos/select-context` y respeta reglas por rol, sucursal y terminal.
- Gestion de turno/caja abierta muestra ventas, pedidos, compras, movimientos, arqueo y tickets asociados al turno actual.
- Permisos y menu se alinean para compras, productos, unidades, impuestos, proveedores y promociones.
- QA manual por rol queda documentado en evidencia local.

## Capabilities

### New Capabilities

- `cash-session-operations`: cierre de caja con dialogos operativos, tickets de cierre, acciones desde historial, POS dependiente de caja abierta, seleccion de contexto y gestion del turno.
- `role-navigation-permissions`: post-login a dashboard, menu lateral por rol/estado operativo, permisos funcionales de compras/catalogos/promociones y proteccion contra acceso directo no autorizado.

### Modified Capabilities

- `access-role-audit`: se mantiene como referencia de auditoria de accesos; este cambio agrega contratos operativos mas especificos en las capacidades nuevas sin archivar la auditoria existente.

## Impact

- Afecta principalmente `web/`, `backend-reporteria/`, `api/` si se requiere reforzar permisos de endpoints, `openspec/changes/...` y `docs/`.
- No debe reabrir el fix ya completado de ticket de pedido para `USER`.
- No debe crear bypass global ni eliminar validaciones multi-tenant.
- No debe tocar produccion, desplegar ni hacer commit.
- Si el alcance excede el turno de trabajo, se completan primero OpenSpec y FASES 2 a 5, dejando pendientes explicitos y evidencia parcial.
