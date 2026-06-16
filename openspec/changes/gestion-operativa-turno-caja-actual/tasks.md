## 1. Diagnostico

- [x] 1.1 Revisar `/{tenant}/finance/cash-sessions`, flujo POS y rutas actuales de tickets.
- [x] 1.2 Revisar `backend-reporteria` para reportes/tickets de ventas, pedidos, compras, movimientos, cierre y arqueo.
- [x] 1.3 Documentar disponibilidad real de `cash_session_id` y brechas del modelo.

## 2. Backend-reporteria

- [x] 2.1 Definir tipos de respuesta de Gestion del turno actual.
- [x] 2.2 Implementar servicio SQL de `GET /api/reports/current-shift`.
- [x] 2.3 Resolver caja abierta autorizada por tenant, sucursal, usuario y rol.
- [x] 2.4 Consolidar pestanas de ventas, pedidos, compras, movimientos, arqueo y tickets.
- [x] 2.5 Agregar tests de scope y respuesta sin caja abierta.
- [x] 2.6 Registrar controller/service en `ReportsModule`.

## 3. Web

- [x] 3.1 Agregar cliente/tipos para consultar `reports/current-shift`.
- [x] 3.2 Crear vista `/{tenant}/finance/current-shift`.
- [x] 3.3 Mostrar header, resumen, pestanas, empty states y CTA a `/pos/select-context`.
- [x] 3.4 Reutilizar acciones existentes para ver, descargar e imprimir tickets.
- [x] 3.5 Agregar acceso a Gestion del turno en navegacion de finanzas.

## 4. QA y evidencia

- [x] 4.1 Crear `docs/evidencia-qa-gestion-operativa-turno-caja-actual.md`.
- [x] 4.2 Registrar QA manual por rol sin inventar PASS.

## 5. Validacion

- [x] 5.1 Ejecutar `openspec.cmd validate gestion-operativa-turno-caja-actual --type change --strict`.
- [x] 5.2 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 5.3 Ejecutar tests especificos y build de `backend-reporteria`.
- [x] 5.4 Ejecutar lint/build de `web`.
- [x] 5.5 Ejecutar `git diff --check` y `git status --short`.

## 6. Fix rapido tickets POS y compra SUPER_USER

- [x] 6.1 Diagnosticar bloqueo `Report role is not authorized` en ticket POS para USER.
- [x] 6.2 Permitir USER solo en `GET /api/reports/pos-sales/:saleId/ticket` y mantener scope SQL/service.
- [x] 6.3 Agregar tests enfocados de ticket POS por rol y scope.
- [x] 6.4 Diagnosticar compra SUPER_USER sin terminal activa.
- [x] 6.5 Resolver terminal desde contexto autorizado de la sucursal seleccionada en `PurchaseForm`.
- [x] 6.6 Mostrar mensaje operativo y CTA a `/pos/select-context` cuando no haya terminal/contexto resoluble.
- [ ] 6.7 Reejecutar QA manual real de ticket POS y compra SUPER_USER por rol.

## 7. Fix rapido facturacion de pedidos con sesion POS

- [x] 7.1 Diagnosticar `Sesion POS requerida` en `POST /api/orders/:orderId/invoice`.
- [x] 7.2 Confirmar que `OrderController.invoice` exige `@RequirePosSession()`.
- [x] 7.3 Permitir que `JwtAuthGuard` resuelva sesion POS activa del mismo `auth_session_id` cuando falta `x-pos-session-id`.
- [x] 7.4 Mantener bloqueo si no existe sesion POS activa autorizada.
- [x] 7.5 Bloquear facturacion si la sesion POS pertenece a otra sucursal que el pedido.
- [x] 7.6 Ajustar `OrderInvoiceForm` para restaurar sesion POS actual, mostrar mensaje claro y CTA a `/pos/select-context`.
- [x] 7.7 Agregar tests enfocados de guard y facturacion cross-branch.
- [ ] 7.8 Reejecutar QA manual real por rol para facturar pedido desde `/{tenant}/orders`.
