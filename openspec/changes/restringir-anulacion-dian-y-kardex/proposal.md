## Why

El flujo de anulación de facturas electrónicas permite seleccionar motivos DIAN que este caso de negocio no habilita: solo corresponde la anulación total, código 2. Además, la reversión operativa crea el movimiento `IN` sin capturar `stock_before` ni `stock_after`, dejando incompleto el Kardex aunque el saldo agregado y los lotes se reviertan.

## What Changes

- Mostrar y enviar exclusivamente `discrepancyResponseCode = "2"` desde el modal de anulación electrónica.
- Validar en backend que el flujo de anulación de factura electrónica acepte solo el código `2`.
- Mantener sin restricción los motivos de otros flujos legítimos de notas crédito.
- Crear movimientos `IN` de reversión con `stock_before` y `stock_after` calculados en el mismo alcance de tenant/sucursal.
- Preservar reversión de lotes, pagos, caja, transmisión/aceptación DIAN y transacciones existentes.
- Evitar doble devolución y conservar la idempotencia de anulación.

## Capabilities

### New Capabilities

- `electronic-sale-void-dian`: Motivo DIAN único para anulación total de factura electrónica.
- `sale-void-kardex`: Reversión de inventario con snapshots de stock y consistencia por lotes.

### Modified Capabilities

<!-- No existe una especificación global equivalente; la HU anterior está archivada como cambio completo. -->

## Impact

- `web/modules/operational-sales/components/VoidSaleModal.tsx` y su servicio/payload.
- `api/src/modules/operational-sales/dto/void-operational-sale.dto.ts` y `operational-sales.service.ts`.
- `api/src/modules/inventory/services/stock-movement.service.ts` como lógica reutilizable de snapshots.
- Pruebas API, frontend y contratos FactuCore relacionados.
- No requiere modificar FactuCore. La serialización se entrega como migración forward-only `V108__serialize_stock_movement_snapshots.sql`.
