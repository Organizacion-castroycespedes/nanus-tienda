## Diagnostico

El backend de compras ya procesa una lista de items enviados, valida pendiente por linea y recalcula el estado de la compra con base en `orderedQuantity` y `receivedQuantity`.

El problema principal esta en el formulario frontend de recepcion: construye filas desde todas las lineas de la compra y no excluye las lineas con pendiente cero. Eso hace que una linea completamente recibida vuelva a aparecer en el formulario y se mezclen campos de lote/recepcion que no aplican a la nueva operacion.

## Decision

La recepcion se basa en cantidades pendientes reales:

`pendingQuantity = max(orderedQuantity - receivedQuantity, 0)`

El frontend debe:

- conservar indices originales para no romper el estado actual del formulario.
- renderizar solo filas con `pendingQuantity > 0`.
- validar y enviar solo filas visibles con cantidad mayor a cero.
- ocultar campos de lote/vencimiento/ubicacion/costo hasta que la fila tenga cantidad a recibir.
- mostrar estado vacio cuando no haya productos pendientes.

El backend mantiene la seguridad transaccional:

- valida que cada linea pertenezca a la compra.
- rechaza cantidades mayores al pendiente.
- procesa solo cantidades positivas enviadas.
- deja lineas no enviadas como pendientes.
- actualiza estado a `PARTIAL` o `RECEIVED` segun corresponda.

## Riesgos

- Compras historicas con cantidades ya inconsistentes pueden seguir mostrando estado parcial segun datos existentes.
- El QA manual debe usar compras de prueba con mas de una linea para validar que las lineas completas desaparecen al reabrir recepcion.
