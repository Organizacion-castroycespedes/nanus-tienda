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

## Estados

- `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CANCELLED`

## Reglas

- solo compras recibidas afectan stock
- proveedor y productos deben pertenecer al tenant
- puede usar branch context
- cancelar requiere permiso `INVENTORY_PURCHASES` con accion `cancel`
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

| Rol | Puede cancelar compras |
| --- | --- |
| `SUPER_ADMIN` | Si |
| `SUPER_USER` | Si |
| `ADMIN` | Si |
| `USER` | No por defecto |

## Impacto y reversos

- Inventario: una compra solo afecta inventario al recibirse. La cancelacion bloquea compras con `stock_movements` o cantidades recibidas.
- Pagos: una compra con `total_paid > 0` o `payment_status` diferente de `PENDING` no se cancela directo.
- Caja: si un pago de compra genero egreso en caja, la cancelacion directa queda bloqueada porque depende del pago.
- Roadmap de reversos: crear flujo explicito de reverso para compras recibidas o pagadas, con movimientos inversos de stock, pagos compensatorios y caja, usando transaccion y auditoria separada.

## Pruebas

- Backend automatizado: `api/src/modules/inventory/services/purchase.service.spec.ts`
- Permisos automatizado: `api/src/common/guards/permissions.guard.spec.ts`
- Frontend: sin runner de pruebas configurado; validar manualmente modal, motivo, toast, PATCH y estado visual.
