# Evidencia frontend focus mode inventario - Fase 4.8

## Objetivo

Mejorar la experiencia visual de foco en inventario avanzado. Cuando el usuario inicia una accion importante, la accion toma foco principal y el listado/filtros pasan fuera de la pantalla activa.

## Archivos modificados

- `web/components/design-system/confirmation-message.tsx`
- `web/modules/inventory/components/FocusActionLayout.tsx`
- `web/app/[tenant]/inventory/products/page.tsx`
- `web/app/[tenant]/inventory/locations/page.tsx`
- `web/modules/inventory/components/ProductBarcodePanel.tsx`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-frontend-focus-mode-inventario-fase-4-8.md`

## Patron UX aplicado

- Se reviso el patron de compras en `web/app/[tenant]/purchases/page.tsx`.
- Se creo `FocusActionLayout` con:
  - titulo de accion,
  - descripcion breve,
  - contexto,
  - boton `Volver`,
  - boton `Cancelar`,
  - contenido principal.
- En modo foco se ocultan filtros, resumenes y tabla/listado principal cuando distraen de la accion.

## Acciones cubiertas

### Productos

- Crear producto.
- Editar producto.
- Gestionar codigos de barras.
- Ajustar stock desde producto.

### Ubicaciones

- Nueva ubicacion.
- Editar ubicacion.
- Inactivar ubicacion con confirmacion visual.

### Inventario por lote

- Se mantiene read-only.
- El detalle rapido sigue como modal ligero.
- No se agregaron acciones de edicion, descuento o correccion.

### Compras y ajustes

- La recepcion de compras ya usa patron de accion enfocada desde la pagina de compras.
- El ajuste manual abierto desde productos ahora queda dentro de focus mode.
- No se cambio payload ni logica de negocio.

## Confirmaciones con `confirmation-message.tsx`

Se extendio el componente existente con props opcionales:

- `variant`
- `actions`

Usos implementados:

- Cancelar accion activa de producto.
- Cancelar accion activa de ubicacion.
- Eliminar producto.
- Inactivar ubicacion.
- Marcar barcode principal.
- Inactivar barcode.

No se usaron `alert()` ni `window.confirm()`.

## Componentes creados o reutilizados

- Creado: `FocusActionLayout`.
- Reutilizado y extendido: `ConfirmationMessage`.
- Reutilizados: `ProductForm`, `ProductBarcodePanel`, `StockAdjustmentForm`, `InventoryLocationForm`.

## Validaciones manuales

Pendientes con API local levantada:

- Productos: crear, cancelar, editar y volver.
- Productos: abrir codigos de barras y volver.
- Productos: inactivar barcode usando `confirmation-message.tsx`.
- Productos: marcar principal usando `confirmation-message.tsx`.
- Productos: abrir ajuste de stock y cancelar.
- Ubicaciones: crear, cancelar, editar y volver.
- Ubicaciones: inactivar usando `confirmation-message.tsx`.
- Lotes: abrir detalle y cerrar.
- Confirmar que filtros/listados vuelven al salir del focus mode.

## Comandos ejecutados

- `cd web && npx tsc --noEmit --pretty false`
- `cd web && npm run build` en copia temporal completa de `web/` sin `.next`
- `cd web && npm run lint`
- `openspec validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`

## Resultado build/lint

- TypeScript: aprobado.
- Build Next.js: aprobado.
- Lint: bloqueado por configuracion interactiva existente de `next lint`; pregunta `How would you like to configure ESLint?`. No se modifico configuracion ESLint.
- OpenSpec strict: aprobado.
- `git diff --check`: aprobado.

## Confirmacion de alcance

- No se modifico `api/`.
- No se modifico `backend-reporteria/`.
- No se modifico `scripts/database/`.
- No se modifico SQL.
- No se modificaron migraciones.
- No se modifico POS de ventas.
- No se modificaron reportes.
- No se cambiaron contratos de API.

## Riesgos vivos

- `ProductForm`, `InventoryLocationForm`, `ProductBarcodePanel` y `StockAdjustmentForm` no exponen dirty state granular; por eso se confirma siempre al cancelar una accion activa.
- El detalle de lote sigue en modal por ser read-only y liviano; si crece, conviene moverlo a focus panel.
- `next lint` sigue sin configuracion no interactiva.

## Proximos pasos

- Validacion manual integral de Fase 5.
- Revisar si otras pantallas de catalogo deben adoptar `FocusActionLayout`.
- Agregar dirty state real por formulario si se prioriza evitar confirmaciones cuando no hubo cambios.
