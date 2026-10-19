## Context

El catálogo POS carga `ProductResponse.stock` y lo conserva en cada línea del
carrito. Ese valor puede quedar obsoleto por otra terminal. Antes del cobro no
hay una actualización explícita. El backend sí es la autoridad final: la
función `inventory_create_sale_v2` calcula stock por tenant, sucursal y
producto, consume FEFO bajo sus locks y lanza `P0001` antes de completar la
venta cuando no puede cumplir.

La transacción de `SaleService.createSale` contiene la reserva de idempotencia,
la llamada a la función, pagos y finalización. Su `ROLLBACK` cubre el rechazo
de la función. El defecto está en la traducción y en la clasificación de UI,
no en una autorización para saltarse inventario.

## Decisions

1. **Traducir después de rollback.** Reconocer únicamente los mensajes
   `insufficient stock for product ...` y `insufficient FEFO lot stock for
   product ...` con código PostgreSQL `P0001`. Ejecutar `ROLLBACK` primero y
   consultar disponibilidad solo para construir el diagnóstico. Si esa lectura
   falla, conservar el error ambiguo.
2. **Contrato estable y sin SQL interno.** Responder `409` con `code`,
   `productId`, `requestedQuantity`, `availableQuantity`,
   `aggregateAvailableQuantity` y `eligibleLotQuantity` cuando aplique. El
   cliente no recibe el texto SQL ni el stack trace.
3. **Rechazo definitivo conserva el carrito.** El cliente actualiza el stock
   mostrado con la disponibilidad recibida, elimina solo el intento fallido y
   vuelve la cuenta a `DRAFT`. No cambia cantidades automáticamente. El usuario
   puede reducir, eliminar, vaciar o cancelar.
4. **UNKNOWN sigue protegido.** Timeout, red, `5xx`, conflictos de idempotencia,
   `NOT_FOUND` de recuperación y respuestas no clasificables conservan la
   cuenta y el mismo `attemptId`.
5. **Refresco antes de cobrar.** `openChargeModal` vuelve a cargar el catálogo
   de la sucursal activa y actualiza el stock visible. Si la cantidad supera el
   stock agregado conocido, no abre el cobro. El backend continúa siendo la
   autoridad final para concurrencia y FEFO.
6. **Aislamiento por cuenta y contexto.** El rechazo se aplica solo al
   `accountId`, `attemptId` y `contextKey` de la operación que falló. Un callback
   tardío no puede desbloquear otra cuenta ni modificar otro tenant o terminal.

## Non-Goals

- No se eliminan claves de idempotencia de resultados ambiguos.
- No se desactiva FEFO ni se modifica `inventory_create_sale_v2`, V108,
  migraciones, pagos, caja o facturación.
- No se corrigen automáticamente cantidades ni se borran datos de
  `localStorage` fuera del contexto exacto.
- No se ejecutan ventas reales, documentos DIAN ni escrituras SQL de prueba.
