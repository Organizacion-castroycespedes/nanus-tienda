## Why

QA manual detecto que el POS no filtra correctamente por categoria en la ruta de venta. Ademas, los controles actuales de clasificacion ocupan demasiado espacio vertical y reducen el area util del grid de productos.

## What Changes

- Corregir el filtro POS por categoria para que compare de forma consistente los IDs de categoria del producto.
- Validar y corregir el filtro POS por subcategoria para que solo muestre productos de la subcategoria seleccionada dentro de la categoria actual.
- Mantener la combinacion correcta entre busqueda de texto, filtro de stock, categoria y subcategoria.
- Limpiar la subcategoria seleccionada cuando deja de pertenecer a la nueva categoria.
- Agregar una accion de limpiar filtros que restablece busqueda, categoria y subcategoria.
- Compactar la UI de filtros con una barra superior de busqueda y un boton/panel de filtros colapsable.
- Mostrar un resumen claro de filtros activos.
- Mantener intactos venta, precios, impuestos, descuentos, stock, cobro, pedidos y creacion de ventas.

## Capabilities

### New Capabilities

- `pos-product-filters`: Cubre el filtrado de productos en POS por busqueda, stock, categoria y subcategoria, junto con la UX compacta para mostrar, ocultar y limpiar filtros.

### Modified Capabilities

- Ninguna. Esta propuesta agrega una capacidad especifica para filtros de productos POS sin modificar requisitos archivados.

## Impact

- Afecta `web/modules/pos/components/PosScreen.tsx`.
- Afecta helpers y tests bajo `web/modules/pos/utils/`.
- Agrega evidencia QA en `docs/`.
- Agrega artefactos OpenSpec en `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/`.
- No cambia backend, SQL, permisos, guards, roles, menus ni contratos de venta.
- No agrega dependencias nuevas.
