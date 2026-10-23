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

## Completed-void visual projection

- Keep the original fiscal invoice in the `INVOICE` projection so other document types cannot replace its status or number.
- `payment_status` remains untouched. The list and detail derive the visual label `Anulada` from terminal sale status (`CANCELLED` or `REFUNDED`) only.
- Sale status remains visible as `Devuelta` or `Cancelada`; the label `Anulada` is an operational payment-display label and does not assert DIAN acceptance.
- A completed local void without an electronic invoice may display `Anulada`.

## Deferred fiscal-note traceability

The void flow receives accepted credit-note metadata transiently from FactuCore but does not persist a durable MANUS sale-to-note association for the normal immediate-success path. Recovering and displaying the actual accepted note number is explicitly deferred. It requires a separate, tenant-safe design and verification against an authorized QA source. This change does not claim that an accepted credit note exists when its association is absent.

## Compatibility

No cambia el esquema de base de datos ni ejecuta migraciones nuevas. Se conservan los contratos existentes y se centralizan únicamente las constantes de estado usadas por este flujo.
