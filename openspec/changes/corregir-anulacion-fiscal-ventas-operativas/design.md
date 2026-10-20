# Design: corregir-anulacion-fiscal-ventas-operativas

## Decision

Usar `ELECTRONIC_BILLING_STATUSES.ACCEPTED` como única condición compartida para tratar una factura como aceptada. Los estados pendientes, en procesamiento, rechazados y de error técnico no autorizan una nota crédito ni la anulación de una venta facturada.

## Backend flow

1. La preparación de una anulación bloquea cualquier factura existente cuyo estado no sea `ACCEPTED`.
2. Una factura `ACCEPTED` se anula mediante nota crédito; la venta se revierte solo cuando la nota crédito también queda aceptada.
3. Una venta sin documento electrónico puede anularse localmente.
4. La reversión financiera calcula `REFUNDED` si hubo pagos `COMPLETED`; de lo contrario usa `CANCELLED`. En ambos casos deja los totales pagados y saldos en cero, y el estado de pago en `PENDING`.
5. Los estados y errores quedan expuestos por el detalle y la respuesta del servicio.

## Frontend flow

`resolveOperationalSaleVoidAvailability` devuelve una de cuatro decisiones: `HIDDEN`, `LOCAL`, `CREDIT_NOTE` o `BLOCKED_ELECTRONIC`. El modal solo muestra la advertencia fiscal y la confirmación de nota crédito para la venta aceptada; el detalle muestra el resultado y el estado de la operación.

## Configuration

`SALE_VOID_REQUEST_WORKER_ENABLED=true` se documenta como valor habilitado en `api/.env.example`, porque el flujo de solicitudes diferidas forma parte de la funcionalidad entregada.

## Compatibility

No cambia el esquema de base de datos ni ejecuta migraciones nuevas. Se conservan los contratos existentes y se centralizan únicamente las constantes de estado usadas por este flujo.
