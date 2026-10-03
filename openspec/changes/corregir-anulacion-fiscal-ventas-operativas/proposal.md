# Proposal: corregir-anulacion-fiscal-ventas-operativas

## Why

La anulación de una venta operativa debe respetar el estado fiscal de su factura electrónica. El flujo anterior permitía avanzar con estados no aceptados y no expresaba con claridad la diferencia entre anulación local y reversión fiscal.

## What Changes

- Bloquear la anulación fiscal cuando la factura electrónica no está `ACCEPTED`.
- Emitir una nota crédito únicamente para una factura electrónica aceptada.
- Permitir anulación local cuando la venta no tiene factura electrónica.
- Revertir los valores financieros de la venta según existan pagos completados y dejar estados coherentes.
- Mostrar en la interfaz si la acción es local, requiere nota crédito, está bloqueada por estado fiscal o ya no está disponible.
- Habilitar el worker de solicitudes de anulación en `api/.env.example`.

## Impact

- API: contrato de estados de facturación y servicio/pruebas de ventas operativas.
- Web: servicio, modal y detalle de venta operativa, con sus pruebas.
- Runtime config: `api/.env.example`.
- No se agregan ni modifican migraciones en este cambio funcional.
