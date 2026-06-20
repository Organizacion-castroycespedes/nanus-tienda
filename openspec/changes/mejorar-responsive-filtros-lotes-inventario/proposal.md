## Why

QA manual detecto overflow horizontal en los filtros de Inventario > Lotes en viewport tablet/escritorio reducido. El layout actual activa una grilla `xl` con columnas fijas que supera el ancho disponible y corta controles.

## What Changes

- Corregir layout responsive del bloque de filtros de lotes.
- Reemplazar columnas fijas rigidas por grilla que envuelve y respeta el contenedor.
- Mantener visibles inputs, selects, checkbox `Solo disponibles`, botones `Buscar`/`Limpiar` y selector `Filas`.
- Mantener scroll horizontal solo dentro del wrapper de tabla cuando sea necesario.
- No cambiar semantica de filtros, contratos API, reglas de negocio, permisos, backend ni SQL.

## Capabilities

### New Capabilities

- `inventory-lots-responsive-filters`: Cubre comportamiento visual responsive de filtros y tabla en la vista Inventario > Lotes.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta `web/app/[tenant]/inventory/lots/page.tsx`.
- Agrega artefactos OpenSpec en `openspec/changes/mejorar-responsive-filtros-lotes-inventario/`.
- No afecta backend, SQL, permisos, guards, contratos API ni reglas de lotes.
