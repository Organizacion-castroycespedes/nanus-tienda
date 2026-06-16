## Why

La vista `Purchases > Recibir compra` se deforma en anchos reducidos y tambien puede verse estirada en desktop. La zona de productos mezcla columnas, inputs y datos de lote/vencimiento/ubicacion/costo, lo que hace dificil operar recepciones parciales.

La tabla necesita scroll horizontal interno para no empujar toda la pagina ni aplastar campos.

## What Changes

- Mejorar layout responsive del formulario de recepcion de compra.
- Asegurar wrappers `w-full` y `min-w-0`.
- Ajustar header y resumen de compra con grid responsive.
- Encapsular productos en scroll horizontal interno.
- Dar ancho minimo razonable a tabla/filas y campos operativos.
- Mantener botones y bloque de confirmacion legibles en mobile y desktop.

## Out of Scope

- Backend.
- SQL.
- Contratos API.
- Calculos de recepcion, inventario, costos, lotes o vencimientos.
- Permisos/guards.
- Cambios de Purchases list/create/edit.
