# Tasks

- [x] Crear OpenSpec change.
- [x] Diagnosticar flujo `orders/:id/delivery`.
- [x] Agregar `@RequireOpenCashSession()` a `POST /api/orders/:id/delivery`.
- [x] Leer `orders.cash_session_id` al crear domicilio desde pedido.
- [x] Asociar domicilio nuevo a caja actual aunque `delivery_fee = 0`.
- [x] Rechazar pedido de otra caja/sesion.
- [x] Completar contexto de caja en domicilio existente inicial sin caja.
- [x] Mantener `cash_impact_amount = delivery_fee`.
- [x] Ajustar frontend para enviar POS session en lookup de domicilio por pedido.
- [x] Ajustar copy frontend para no afirmar que el flujo no toca caja.
- [x] Agregar tests backend enfocados.
- [x] Crear evidencia QA.
- [x] Ejecutar validaciones finales.
