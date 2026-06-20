## Why

La vista POS solo muestra productos en tarjetas de cuadrícula. En operación con muchos productos, el usuario necesita una vista vertical/lista para escanear nombres, SKU, unidad, stock, precio y acción de agregar sin perder filtros ni carrito.

## What Changes

- Agregar un selector visual `Cuadricula` / `Lista` en la zona superior del catálogo de productos POS.
- Mantener `Cuadricula` como vista por defecto para conservar la UX actual.
- Mantener el diseño actual de tarjetas cuando el modo activo sea cuadrícula.
- Agregar un layout de lista vertical con una fila/card horizontal por producto.
- Conservar búsqueda, filtros de categoría/subcategoría, filtro de stock y carrito al alternar vista.
- Mantener estados visuales de stock, producto en carrito, precio final, unidad y botón de agregar en ambos modos.
- Mantener comportamiento existente para productos sin stock, productos pesables y permisos de venta.
- Asegurar comportamiento responsive sin overflow horizontal global.
- No cambiar backend, SQL, contratos API, permisos, guards, roles, precios, descuentos, impuestos, stock, carrito ni flujo de cobro.

## Capabilities

### New Capabilities

- `pos-product-list-layout`: Cubre la selección visual entre cuadrícula y lista para el catálogo de productos en POS, incluyendo persistencia visual local, accesibilidad y comportamiento responsive.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta `web/modules/pos/components/PosScreen.tsx`.
- Agrega evidencia QA en `docs/evidencia-qa-vista-productos-pos-grid-lista.md`.
- Agrega artefactos OpenSpec en `openspec/changes/mejorar-vista-productos-pos-grid-lista/`.
- No afecta backend, SQL, contratos API, permisos, guards, roles, cálculo de precios, descuentos, impuestos, stock, carrito ni flujo de cobro.
- No agrega dependencias nuevas.
