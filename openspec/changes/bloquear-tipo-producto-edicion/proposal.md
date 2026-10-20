# Bloquear tipo de producto durante edicion

## Why

El formulario de productos permite cambiar `is_inventoryable` despues del primer guardado y envia `inventoryabilityChangeReason` al actualizar. El tipo persistido debe ser inmutable desde la interfaz de edicion, porque el cambio altera la interpretacion operativa del producto.

## What Changes

- Mantener `isInventoryable` seleccionable al crear productos.
- Mostrar el tipo persistido en edicion mediante un control deshabilitado y una explicacion visible.
- Ocultar el campo `Motivo del cambio a servicio` en edicion.
- Omitir `isInventoryable` e `inventoryabilityChangeReason` del payload de actualizacion.
- Conservar el valor persistido, incluyendo productos inventariables y servicios existentes.
- Mantener editables los demas atributos actualmente autorizados.

## Scope

Este cambio afecta solo el frontend en `web/modules/inventory`. No cambia backend, base de datos, endpoints ni operaciones comerciales. El bloqueo frontend no reemplaza la autoridad del backend contra llamadas directas a la API.

## Compatibility

La creacion conserva el contrato actual y envia la seleccion de `isInventoryable`. La edicion usa actualizacion parcial sin ese campo, por lo que el backend conserva el valor persistido.
