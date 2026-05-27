# Modulo purchases

## Proposito

Gestiona compras, recepcion de mercancia y entrada a inventario.

## Endpoints

- `GET /api/purchases`
- `POST /api/purchases`
- `GET /api/purchases/:id`
- `PUT /api/purchases/:id`
- `POST /api/purchases/:id/receive`
- `PATCH /api/purchases/:id/cancel`
- `PATCH /api/purchases/:id/settle-partial`

## Estados

- `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CERRADA_PARCIAL`, `CANCELLED`

## Matriz de estados de compra

| Estado | Significado | Recibe mercancia | Puede liquidar parcial |
| --- | --- | --- | --- |
| `DRAFT` | Compra en borrador o no confirmada | No | No |
| `PENDING` | Compra abierta sin recepcion completa | Si | No |
| `PARTIAL` | Compra parcialmente recibida y abierta | Si | Si, con permiso |
| `RECEIVED` | Compra recibida completa | No | No |
| `CERRADA_PARCIAL` | Compra liquidada con cantidades realmente recibidas | No | No |
| `CANCELLED` | Compra cancelada/anulada | No | No |

## Reglas

- solo compras recibidas afectan stock
- proveedor y productos deben pertenecer al tenant
- puede usar branch context
- cancelar requiere permiso `INVENTORY_PURCHASES` con accion `cancel`
- liquidar parcial requiere permiso `INVENTORY_PURCHASES` con accion `settle_partial`
- solo se cancela una compra `DRAFT` o `PENDING` sin pagos ni movimientos de inventario
- si existe recepcion, movimiento `stock_movements`, pago o caja, la cancelacion directa queda bloqueada
- reportes muestran compras `CANCELLED` como anuladas, pero no las suman en totales monetarios

## Funcionalidad: Cancelacion de compras no recibidas/no finalizadas

- Ruta UI: `/[tenant]/inventory/purchases`
- Endpoint real: `PATCH /api/purchases/:purchaseId/cancel`
- Endpoint conceptual de inventario: `PATCH /api/inventory/purchases/:purchaseId/cancel`
- Permiso: `INVENTORY_PURCHASES` con accion `cancel` (`inventory.cancel` en frontend)
- Estado final: `CANCELLED` (visible como CANCELADA)
- Motivo obligatorio: si
- Auditoria: si, evento `PURCHASE_CANCELLED` en `auditoria_eventos`

Body:

```json
{
  "motivoCancelacion": "Proveedor informo que no podra entregar la compra."
}
```

Respuesta:

```json
{
  "statusCode": 200,
  "message": "Compra cancelada correctamente",
  "data": {
    "id": "uuid",
    "estado": "CANCELLED",
    "motivoCancelacion": "Proveedor informo que no podra entregar la compra.",
    "canceladoEn": "2026-05-27T00:00:00.000Z"
  }
}
```

## Matriz de permisos

| Rol | Puede cancelar compras | Puede liquidar parcial |
| --- | --- | --- |
| `SUPER_ADMIN` | Si | Si |
| `SUPER_USER` | Si | Si |
| `ADMIN` | Si | Si |
| `USER` | No por defecto | No por defecto |

## Impacto y reversos

- Inventario: una compra solo afecta inventario al recibirse. La cancelacion bloquea compras con `stock_movements` o cantidades recibidas.
- Pagos: una compra con `total_paid > 0` o `payment_status` diferente de `PENDING` no se cancela directo.
- Caja: si un pago de compra genero egreso en caja, la cancelacion directa queda bloqueada porque depende del pago.
- Roadmap de reversos: crear flujo explicito de reverso para compras recibidas o pagadas, con movimientos inversos de stock, pagos compensatorios y caja, usando transaccion y auditoria separada.

## Funcionalidad: Liquidacion de compra parcial

- Ruta UI: `/[tenant]/inventory/purchases`
- Endpoint real: `PATCH /api/purchases/:purchaseId/settle-partial`
- Endpoint conceptual de inventario: `PATCH /api/inventory/purchases/:purchaseId/settle-partial`
- Permiso: `INVENTORY_PURCHASES` con accion `settle_partial` (`inventory.settle_partial` en frontend)
- Estado final: `CERRADA_PARCIAL`
- Motivo obligatorio: si
- Auditoria: si, evento `PURCHASE_PARTIAL_CLOSED`
- Total liquidado: `SUM(received_quantity * cost)`
- Valor no recibido: `SUM((ordered_quantity - received_quantity) * cost)`

## Funcionalidad: Liquidacion de compra parcial con cantidades realmente recibidas

- Ruta: `/[tenant]/inventory/purchases`
- Endpoint solicitado: `PATCH /api/inventory/purchases/:purchaseId/settle-partial`
- Endpoint real actual: `PATCH /api/purchases/:purchaseId/settle-partial`
- Estado destino: `CERRADA_PARCIAL`
- Regla principal: la compra se cierra tomando como valor final el total realmente recibido.
- Restriccion: no se puede liquidar si los pagos registrados superan el valor recibido.

Body:

```json
{
  "motivoLiquidacion": "Proveedor no entregara las unidades pendientes. Se liquida con lo recibido."
}
```

Respuesta:

```json
{
  "statusCode": 200,
  "message": "Compra liquidada correctamente con las cantidades recibidas",
  "data": {
    "id": "uuid",
    "estado": "CERRADA_PARCIAL",
    "totalPedido": 76920,
    "totalRecibido": 51280,
    "totalLiquidado": 51280,
    "totalPagado": 0,
    "saldoPendiente": 51280,
    "diferenciaNoRecibida": 25640
  }
}
```

Reglas:

- Compra `RECEIVED`: queda recibida completa y conserva el total original.
- Compra `PARTIAL`: sigue abierta y permite recibir saldo pendiente.
- Compra `PARTIAL` liquidada: cambia a `CERRADA_PARCIAL`, recalcula total/saldo y bloquea nuevas recepciones.
- Sin pagos: `payment_status = PENDING` y `balance_due = total_liquidado`.
- Pago parcial menor al total liquidado: `payment_status = PARTIAL` y `balance_due = total_liquidado - total_pagado`.
- Pago igual al total liquidado: `payment_status = PAID` y `balance_due = 0`.
- Pago mayor al total liquidado: bloqueado hasta gestionar devolucion o ajuste. No hay devolucion automatica en esta fase.
- Compra `CERRADA_PARCIAL`: no recibe mas productos y no puede liquidarse otra vez; puede pagar saldo pendiente.
- Compra `CANCELLED`: no recibe, no liquida y no paga.

Impacto en inventario:

- La recepcion de compra ya incrementa inventario con `stock_movements.type = IN`.
- Cada recepcion crea movimiento por la cantidad recibida y luego suma `purchase_items.received_quantity`.
- Los productos pendientes no recibidos no entran al stock.
- La liquidacion parcial no crea movimientos nuevos de inventario; solo cierra la compra y recalcula valores contables.
- Esto evita duplicar entradas de stock para cantidades ya recibidas.

Ticket/PDF de compra:

- Funcion de datos: `report_purchase_ticket`.
- Plantilla: `backend-reporteria/src/modules/pdf/templates/tickets/purchase-ticket.template.ts`.
- Para `CERRADA_PARCIAL`, el ticket muestra total pedido, total recibido/liquidado, diferencia no recibida, motivo, fecha y usuario de liquidacion.
- El detalle de items muestra cantidad pedida, recibida, no recibida, costo unitario, subtotal recibido y subtotal no recibido.

Reporteria:

- Funcion de datos: `report_purchases`.
- Las compras `CERRADA_PARCIAL` suman por `total_liquidado`, no por el total pedido original.
- La diferencia no recibida se expone como `diferenciaNoRecibida` por compra y `totalNoRecibido` en el resumen.
- El reporte permite filtrar por estado, incluyendo `CERRADA_PARCIAL`.

## Pruebas

- Backend automatizado: `api/src/modules/inventory/services/purchase.service.spec.ts`
- Permisos automatizado: `api/src/common/guards/permissions.guard.spec.ts`
- Frontend: sin runner de pruebas configurado; validar manualmente:
  - boton `Liquidar compra` visible solo en compras `PARTIAL` con permiso `inventory.settle_partial`
  - boton oculto en `RECEIVED`, `CANCELLED`, `CERRADA_PARCIAL` o sobrepago
  - modal abre y muestra tabla pedido/recibido/pendiente
  - motivo obligatorio entre 5 y 300 caracteres
  - `PATCH /api/purchases/:id/settle-partial` ejecutado con `motivoLiquidacion`
  - toast de exito `Compra liquidada correctamente con las cantidades recibidas.`
  - estado visual cambia a `CERRADA_PARCIAL`
  - boton `Recibir` queda oculto despues de liquidar
  - boton `Pagar` queda disponible si existe saldo pendiente sobre total liquidado

## Criterios de aceptacion

- Una compra `PARTIAL` puede liquidarse con lo recibido.
- El total liquidado se calcula desde cantidades recibidas persistidas.
- Productos no recibidos no ingresan al inventario.
- La compra cambia a `CERRADA_PARCIAL`.
- Despues de liquidar, no se puede recibir mas mercancia.
- El pago pendiente se calcula sobre `total_liquidado`.
- Si `total_pagado > total_recibido`, la liquidacion se bloquea.
- Motivo, usuario, fecha e historial quedan registrados.
- El detalle muestra total pedido, total recibido, diferencia y motivo.
- Ticket/PDF reflejan liquidacion parcial.
- Reportes usan `total_liquidado`, no `total_pedido`.
- Permisos se respetan en frontend y backend.
- No se afecta el modulo `/orders`.
