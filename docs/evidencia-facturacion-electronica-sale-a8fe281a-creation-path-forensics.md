# Evidencia: procedencia de creación de venta y outbox

## Alcance

Investigación de solo lectura para la venta `a8fe281a-1763-4148-875b-19bd99a29c2d`. No se cambió la venta, no se insertó outbox, no se creó documento electrónico y no se llamó FactuCore o DIAN.

## Estado observado

- Base QA: `manus_tienda_qa`, esquema `public`.
- Venta: `CONFIRMED`, tipo `CASH`, `PAID`.
- Total y total pagado: `48000.00`.
- Tiene cliente, un pago completado y una línea con producto.
- Outbox `SALE_COMPLETED_FOR_ELECTRONIC_BILLING` para la venta: cero.

## Contrato del productor

El código actual conecta `SaleService.createSale()` y `createSaleFromOrderDelivery()` con `enqueueSaleCompletedForElectronicBilling()`. El productor construye el snapshot y llama `IntegrationOutboxService.enqueueSaleCompletedEvent()` dentro de la misma transacción. La venta `CONFIRMED` se obtiene después de `finalizeSale()`; no requiere una transición posterior.

El repositorio usa `ON CONFLICT (event_id) DO NOTHING`, con identidad determinística por tenant y venta. Pruebas locales cubren una venta elegible con un evento y rutas sin servicio outbox con cero eventos.

## Comparación

La venta de trabajo `30a0a076-d3df-483f-8966-d6e3c9f3717e` también es `CONFIRMED` / `PAID` / `CASH`, pero tiene un evento `PENDING`. La diferencia probada es la presencia del evento, no el estado comercial.

## Conclusión

La fuente exacta de creación de la venta controlada no está registrada en los datos disponibles. No hay auditoría/log de productor para esa venta. Como el código fuente y el build actual sí contienen el productor, las hipótesis restantes son un runtime/path alterno o una creación histórica fuera del flujo normal; ninguna queda demostrada.

No existe mecanismo oficial de recuperación individual identificado. El evento no se debe sintetizar manualmente porque es un snapshot fiscal inmutable.

## Resultado

- Causa raíz: no identificada.
- Productor actual: correcto.
- Venta controlada: bloqueada para facturación.
- Acción segura: crear una nueva venta mediante el flujo normal, en una tarea posterior y con los workers deshabilitados.
- Mutaciones: cero.
