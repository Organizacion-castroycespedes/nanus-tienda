# Design

`ProductForm` sigue usando `mode === "create"` y `mode === "edit"` como fuente del modo. `createInitialValues(product)` hidrata `isInventoryable` desde `ProductResponse`; no se agregan defaults nuevos en edicion.

`ProductOperationalSection` recibe `structuralConfigurationLocked` y usa esa bandera para renderizar el selector de tipo deshabilitado solo en edicion. El valor visual se deriva de `values.isInventoryable`, que viene del producto cargado. Se muestra texto de bloqueo. El campo `inventoryabilityChangeReason` se elimina de la UI porque ya no existe una transicion operativa desde este formulario.

En `handleSubmit`, el payload de creacion conserva `isInventoryable`. Para edicion, se construye `editablePayload` desde el payload existente y se elimina `isInventoryable` junto con los campos estructurales ya bloqueados. Tambien se elimina cualquier asignacion de `inventoryabilityChangeReason`. Los atributos comerciales y operativos permitidos siguen viajando igual.

El contrato actual de `UpdateProductPayload` es `Partial<CreateProductPayload>` y acepta omitir `isInventoryable`; `updateProduct` envia el objeto parcial al mismo endpoint existente. No se modifica el servicio remoto.

Las pruebas de seccion verifican tipo seleccionable en creacion, tipo bloqueado para producto inventariable y servicio en edicion, texto explicativo y ausencia del motivo. La proteccion de payload se cubre con un helper puro para que no dependa de montar todo el formulario.
