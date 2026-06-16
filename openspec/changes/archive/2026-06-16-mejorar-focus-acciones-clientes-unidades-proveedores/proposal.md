## Why

Clientes, Unidades, Proveedores e Impuestos permiten iniciar acciones operativas, pero el formulario convive con filtros y listados. Esto hace que el usuario pierda foco visual y mezcle la accion activa con contenido que no necesita mientras crea o edita.

El change evoluciono desde Clientes, Unidades y Proveedores hacia una capacidad transversal: **Focus UX para acciones de catalogo**.

## What Changes

- Aplicar un modo de accion enfocada para crear/editar en Clientes, Unidades, Proveedores e Impuestos.
- Enfocar confirmaciones destructivas cuando el modulo ya soporta eliminar.
- Ocultar filtros, listados y acciones secundarias mientras hay una accion activa.
- Permitir volver/cancelar al listado sin perder el contexto de filtros ya cargado.
- Mostrar confirmacion visual con `ConfirmDialog` despues de crear o editar correctamente.
- Mantener manejo de errores existente sin disparar dialogos de exito en fallas.
- Mantener compatibilidad mobile y no romper filtros, paginacion ni listados.
- Documentar una guia reusable para futuros catalogos.
- Registrar evidencia tecnica y QA visual pendiente sin marcar PASS manual.

## Capabilities

### New Capabilities

- `catalog-action-focus-ux`: UX enfocada para acciones de catalogos operativos y confirmacion visual post guardado.

### Modified Capabilities

Ninguna.

## Impact

- Afecta solo frontend `web`.
- Vistas objetivo:
  - `web/app/[tenant]/customers/page.tsx`
  - `web/app/[tenant]/inventory/units/page.tsx`
  - `web/app/[tenant]/suppliers/page.tsx`
  - `web/app/[tenant]/inventory/taxes/page.tsx`
- Componentes reutilizados/ajustados:
  - `web/modules/inventory/components/FocusActionLayout.tsx`
  - `web/components/design-system/confirm-dialog.tsx`
- Documentacion:
  - `docs/frontend/catalog-action-focus-ux.md`
  - `docs/evidencia-qa-focus-ux-catalogos.md`
- Sin cambios SQL previstos.
- Sin cambios backend, permisos ni guards.
