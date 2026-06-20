## Why

QA manual detecto que el boton `Filtros` del POS puede quedar blanco o visualmente vacio cuando hay filtros activos. Esto rompe legibilidad justo cuando el operador necesita saber que el catalogo esta filtrado.

## What Changes

- Corregir el estado visual activo del boton `Filtros` en el header/buscador POS.
- Mantener visibles icono, texto `Filtros`, badge y chevron con filtros activos.
- Usar contraste estable en normal, hover, focus y active.
- Limitar el cambio a estilos del boton de filtros POS.
- No modificar logica de filtrado, productos, carrito, ventas, pricing, impuestos, stock ni promociones.

## Capabilities

### New Capabilities

- `pos-filter-button-visual-state`: Cubre la legibilidad y contraste del boton `Filtros` del POS en estado normal y con filtros activos.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta `web/modules/pos/components/PosScreen.tsx`.
- Agrega evidencia QA en `docs/evidencia-qa-pos-filter-button-active-state.md`.
- Agrega artefactos OpenSpec en `openspec/changes/corregir-estado-visual-boton-filtros-pos/`.
- No cambia backend, SQL, permisos, guards, ventas, carrito ni calculos POS.
