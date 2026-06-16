## Why

La recepcion de compras muestra lineas que ya estan completas y puede obligar al usuario a volver a capturar datos de lote o recepcion para productos sin pendiente real.

Tambien se necesita confirmar recepciones parciales validas cuando una compra tiene varias lineas y solo llegan algunos productos.

## What Changes

- Calcular pendiente por linea como cantidad pedida menos cantidad recibida.
- Mostrar en el formulario solo lineas con pendiente mayor a cero.
- Permitir confirmar recepcion con un subconjunto de lineas pendientes.
- Enviar al API solo lineas con cantidad recibida mayor a cero.
- Validar que la cantidad recibida no exceda el pendiente.
- Mantener lote, vencimiento, ubicacion y costo solo para lineas efectivamente recibidas.
- Mantener el estado parcial o recibido segun cantidades reales.

## Out of Scope

- SQL destructivo o migraciones.
- Cambios contables no relacionados.
- Cambios de POS, pedidos o facturacion electronica.
- Cambios de permisos o guards.
- Refactors amplios de compras o inventario.
