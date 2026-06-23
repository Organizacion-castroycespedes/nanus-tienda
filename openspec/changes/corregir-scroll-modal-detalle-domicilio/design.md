## Current State

`DeliveryDetailPanel` usa el componente compartido `Modal` con contenido largo: acciones, grilla de campos, notas e informacion operativa. El modal no limita internamente la altura del contenido, asi que en viewport pequeno el contenido puede salir de pantalla.

## Approach

- Mantener `Modal` compartido sin cambios para evitar impacto lateral en otros modulos.
- Pasar `className` desde `DeliveryDetailPanel` para limitar el contenedor del modal con `max-height` responsive y `overflow-hidden`.
- Envolver el contenido del detalle en un contenedor interno con `overflow-y-auto`, `overflow-x-hidden`, `min-w-0` y `max-height` calculado.
- Hacer el bloque de acciones sticky dentro del area scrollable cuando exista, para que siga visible mientras se revisa el detalle.
- Mantener el footer del modal visible fuera del area scrollable.

## Non Goals

- No se redisenan acciones ni reglas de estado.
- No se cambia el componente `Modal` global.
- No se toca backend, SQL, permisos, caja, POS, facturacion ni pagos.

## QA Notes

La QA manual debe confirmar desktop y movil:

- El contenido alto hace scroll dentro del modal.
- Las acciones son visibles o alcanzables.
- No aparece overflow horizontal global.
- El boton cerrar sigue accesible.
