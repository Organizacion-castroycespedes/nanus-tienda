## Context

El modulo actual `/{tenant}/finance/cash-sessions` permite abrir, cerrar, ver resumen y ticket de cierre. No existe una vista operativa enfocada en la caja abierta actual con pestanas por ventas, pedidos, compras, movimientos, arqueo y tickets.

`backend-reporteria` ya concentra reportes y tickets PDF para ventas POS, pedidos, compras, cierres y arqueos. El endpoint nuevo se implementa alli para consultar y consolidar datos operativos, no para crear reporteria historica.

Diagnostico de datos:
- `cash_sessions` tiene caja abierta por usuario, tenant, sucursal y caja registradora.
- `cash_movements` tiene `cash_session_id` directo.
- `payments` tiene `cash_session_id` y permite asociar pagos de ventas, pedidos y compras a caja.
- Ventas POS tienen trazabilidad por pagos y, segun flujo, `cash_session_id` en pagos/movimientos.
- Pedidos no tienen columna directa `cash_session_id`; se pueden asociar al turno cuando existen pagos en `payments` con `reference_type = 'SALES_ORDER'` y `cash_session_id` de la caja abierta.
- Compras no tienen columna directa `cash_session_id`; se pueden asociar al turno cuando existen pagos en `payments` o movimientos de caja vinculados a la sesion.
- Arqueo usa `cash_counts.cash_session_id`; para caja abierta puede no existir arqueo final todavia.
- Tickets existentes: venta POS, pedido, compra, cierre caja y arqueo. Ticket de cierre solo aplica a sesiones cerradas.

## Goals / Non-Goals

**Goals:**
- Agregar consulta operativa del turno actual desde `backend-reporteria`.
- Resolver la caja abierta actual de forma segura por usuario/tenant/contexto.
- Exponer una vista web `/{tenant}/finance/current-shift` con resumen y pestanas operativas.
- Permitir ver, descargar e imprimir tickets cuando el endpoint exista y el usuario tenga scope.
- Documentar brechas reales sin inventar relaciones inexistentes.

**Non-Goals:**
- No crear dashboard historico global.
- No migrar datos historicos ni hacer backfill de `cash_session_id`.
- No crear una nueva fuente transaccional de caja.
- No reemplazar los flujos existentes de cierre, POS, pedidos o compras.

## Decisions

1. **Endpoint consolidado en `backend-reporteria`**
   - Decision: crear `GET /api/reports/current-shift`.
   - Rationale: reporteria ya tiene DB access, guard JWT y tickets PDF.
   - Alternativa descartada: armar la vista con multiples endpoints web/API. Eso duplica scope y aumenta riesgo de mezclar datos historicos.

2. **Resolver caja abierta actual en backend**
   - Decision: por defecto buscar `cash_sessions.status = 'OPEN'` en el tenant del JWT y usuario actual. Para ADMIN/SUPER_USER/SUPER_ADMIN se permite `cashSessionId` o `branchId` solo si pasa scope.
   - Rationale: el frontend no debe decidir alcance seguro.

3. **Asociacion por `cash_session_id` solo cuando exista**
   - Decision: ventas, pagos, movimientos y arqueos usan `cash_session_id`; pedidos/compras aparecen solo si hay pago/movimiento asociado a la caja abierta.
   - Rationale: no inventar datos ni inferir por fecha/sucursal cuando el modelo no garantiza relacion.

4. **Tickets como acciones no criticas**
   - Decision: las filas exponen URLs para tickets existentes; imprimir usa blob/ventana manual.
   - Rationale: la consulta operativa no debe fallar si el navegador bloquea popup o el agente local no existe.

## Risks / Trade-offs

- Pedidos o compras sin pago asociado a caja no apareceran en pestanas de turno -> se documenta como limitacion real del modelo actual.
- Si la caja abierta existe pero no hay movimientos, varias pestanas quedaran vacias -> empty states operativos.
- SUPER_USER con varias cajas abiertas de usuarios distintos puede requerir `cashSessionId` para seleccionar una caja especifica -> el endpoint valida tenant/scope.
- Los tickets de cierre no aplican a caja abierta -> se muestran solo si hay cierre o quedan deshabilitados.
