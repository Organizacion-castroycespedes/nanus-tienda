# Matriz de contratos transaccionales POS — B4.1

Solo incluye contratos encontrados en código. Las rutas de catálogo y contexto
se incluyen como dependencias del POS, no como confirmación de que cada pantalla
complete una venta.

| Método y ruta | Entrada/headers | Controles | Responsabilidad | Errores/resultado | Evidencia |
|---|---|---|---|---|---|
| `POST /api/sales` | `CreateSaleBody`; `Idempotency-Key`; contexto POS | JWT, roles, `POS WRITE`, `RequireOpenCashSession`, `RequirePosSession` | Crea venta directa, pagos, stock y outbox opcional | `SaleResponse`; rechazo por contexto, precio, stock, pago, duplicidad o SQL | `sale.controller.ts:165-180`; `sale.service.ts:2541-2745` |
| `GET /api/sales/idempotency/:key` | clave en URL; contexto POS | JWT, roles, `POS READ` | Reconcilia creación previa | Venta si existe; ausencia si no hay registro | `sale.controller.ts:183-190`; `pos.service.ts:111-114` |
| `GET /api/sales`, `GET /api/sales/:id` | filtros o id | JWT, roles, `POS READ` | Consulta ventas | JSON de venta/listado | `sale.controller.ts:192-209` |
| `POST /api/sales/:id/cancel` | id y contexto | JWT, roles, `POS WRITE`, caja abierta | Cancela y compensa stock/pagos | `CANCELLED` o `REFUNDED`; rollback ante error | `sale.controller.ts:240-245`; `sale.service.ts:3086-3365` |
| `POST /api/pricing/preview-line` | branch, product, quantity, channel `POS`, cliente opcional | JWT, roles, `INVENTORY_PRODUCTS READ` | Vista previa de precio, impuesto y promoción | `LinePricePreview`; error de producto/regla | `pricing.controller.ts:46-73`; `pricing.service.ts:35-621` |
| `GET /api/products?branchId=` | sucursal | Cliente Web; controles backend del módulo | Catálogo usado por POS | Lista de productos | `web/modules/pos/services/pos.service.ts:85-90` |
| `GET /api/customers`, `GET /api/taxes` | headers de sesión | Contrato cliente Web; autorización backend no duplicada aquí | Datos auxiliares de UI | Listas JSON | `web/modules/pos/services/pos.service.ts:92-99` |
| `POST /api/pos/session`, `GET /api/pos/session/current` | contexto tenant/sucursal/terminal | Módulo de sesión POS | Fija o consulta contexto operativo | Sesión POS o error de contexto | `docs/architecture.md`; `web/domains/pos/api.ts` |

## Notas de contrato

- `price` aparece en el DTO Web, pero el backend calcula el precio POS antes de
  persistir. El valor de interfaz no es autoridad única.
- `includePosSession: true` es una instrucción del cliente `apiClient`; no prueba
  por sí sola autorización. La autoridad está en guards, contexto y servicio.
- `cashSessionId` puede venir por pago, pero `PaymentsService` valida la sesión
  abierta, sucursal y usuario.
- La ruta fiscal no es llamada directamente por Web durante la venta; la relación
  se realiza mediante Integration Outbox cuando la política lo permite.
- El endpoint de reportería no se presenta como dependencia de `POST /sales`.
  La integración HTTP API-Reportería sigue no certificada según B2.3.

## Contratos fuera de alcance

No se identificó en esta revisión un endpoint independiente de devolución parcial,
reserva Web de inventario o entrega exactamente una vez. Los flujos de pedidos que
se convierten en venta usan `createSaleFromOrderDelivery` y deben analizarse como
contrato separado.
