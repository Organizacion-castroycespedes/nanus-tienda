## Why

El detalle de Domicilio puede crecer mas que el viewport y el modal queda fijo, dejando acciones y contenido fuera de alcance en pantallas pequenas. Esto bloquea operacion basica desde `/{tenant}/deliveries`.

## What Changes

- Agregar scroll vertical interno al detalle de domicilio.
- Limitar la altura maxima del modal de forma responsive.
- Evitar overflow horizontal en contenido largo.
- Mantener acciones visibles o accesibles dentro del modal.
- Mantener el diseno actual sin redisenar el flujo.
- No tocar backend, SQL, permisos, caja, POS, facturacion ni pagos.

## Capabilities

### New Capabilities

- `deliveries-detail-modal`: Cubre el comportamiento responsive y accesible del modal de detalle de domicilio.

### Modified Capabilities

## Impact

- Frontend: `web/modules/deliveries/components/DeliveryDetailPanel.tsx`.
- Docs/evidencia: `docs/evidencia-qa-scroll-modal-detalle-domicilio.md`.
- Sin cambios en API, base de datos, permisos, caja, POS, facturacion electronica ni pagos.
