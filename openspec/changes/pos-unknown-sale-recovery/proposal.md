## Why

POS tiene una recuperación insegura cuando una creación de venta queda ambigua. Un cambio de carrito puede limpiar `saleAttempt` mientras `saleStatus` es `UNKNOWN`, y `submitSale` trata cualquier `4xx`, incluido el `409` de idempotencia, como rechazo definitivo. Además, la reconciliación existente no tiene una acción normal visible en UI. Esto puede permitir un segundo POST con una clave nueva después de una venta ya confirmada.

## What Changes

- Crear `HU-POS-UNKNOWN-SALE-001` para recuperación explícita y primero reconciliar.
- Mantener `UNKNOWN` y `saleAttempt` por cuenta ante edición, scanner, cancelación y eliminación.
- Exponer una acción visible para consultar la venta con `GET /sales/idempotency/:key`.
- Diferenciar conflictos de idempotencia de rechazos definitivos y conservar la misma clave.
- Separar el error de `createSale` de impresión, facturación electrónica, refresco de productos y otros pasos posteriores.
- Impedir doble submit y cualquier transición concurrente que descarte `saleAttempt` durante `SUBMITTING`.
- Mantener errores HTTP no demostrablemente previos a COMMIT en `UNKNOWN`, sin liberar la clave.
- Agregar regresiones aisladas con mocks y fixtures, sin ventas reales ni cambios de backend.

## Capabilities

### New Capabilities

- `pos-unknown-sale-recovery`: recuperación segura de ventas POS ambiguas, idempotencia y aislamiento entre cuentas.

### Modified Capabilities

- Ninguna. La idempotencia backend existente se conserva sin cambiar su persistencia ni sus contratos.

## Impact

- Frontend: `PosScreen`, `posCart` y pruebas relacionadas.
- Contratos existentes: `createSale` y `reconcileSale` se reutilizan.
- Backend, base de datos, Electron, periféricos, caja, inventario y facturación electrónica: sin cambios previstos.
- No se contactan endpoints QA o PRD durante esta implementación.
