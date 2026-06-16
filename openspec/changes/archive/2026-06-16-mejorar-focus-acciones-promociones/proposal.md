## Why

Promociones usa modales para acciones operativas de crear y editar. Esto saca al usuario del flujo de catalogo y mezcla estados visuales cuando necesita volver al listado, cancelar o guardar.

El proyecto ya tiene un patron transversal documentado: **Focus UX para acciones de catalogo**. Promociones debe adoptar el mismo estandar sin cambiar reglas de negocio, API, permisos ni backend.

## What Changes

- Reemplazar modales de crear/editar por paneles enfocados dentro de la pagina.
- Reutilizar `FocusActionLayout` para crear, editar y desactivar promociones.
- Ocultar listado, filtros y acciones secundarias mientras haya una accion activa.
- Agregar mecanismo claro de cancelar/regresar.
- Mostrar `ConfirmDialog` success despues de crear, editar o desactivar correctamente.
- Mantener validaciones, payloads, filtros, listado y manejo de errores actuales.
- Mantener compatibilidad desktop/mobile.
- Documentar evidencia tecnica y QA visual pendiente si no se ejecuta navegador real.

## Capabilities

### New Capabilities

- `promotion-action-focus-ux`: UX enfocada para acciones operativas del modulo Promociones.

### Modified Capabilities

Ninguna.

## Impact

- Afecta solo frontend `web`.
- Vista objetivo:
  - `web/app/[tenant]/inventory/promotions/page.tsx`
- Componentes reutilizados:
  - `web/modules/inventory/components/FocusActionLayout.tsx`
  - `web/components/design-system/confirm-dialog.tsx`
- Componente nuevo esperado:
  - `web/modules/pricing/components/PromotionFormPanel.tsx`
- Evidencia:
  - `docs/evidencia-qa-focus-ux-promociones.md`
- Sin cambios SQL.
- Sin cambios backend, permisos ni guards.
