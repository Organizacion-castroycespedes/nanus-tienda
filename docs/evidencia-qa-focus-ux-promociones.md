# Evidencia QA Focus UX Promociones

Fecha: 2026-06-16

## Estado final

- Estado tecnico: PASS.
- QA manual en navegador: PASS.

## Alcance

- Modulo: Promociones.
- Ruta: `/{tenantId}/inventory/promotions`.
- Acciones cubiertas:
  - Crear promocion.
  - Editar promocion.
  - Desactivar promocion.
  - Cancelar/regresar al listado.

## Patron aplicado

- `FocusActionLayout` para acciones activas.
- `PromotionFormPanel` para renderizar el formulario dentro de la pagina.
- `ConfirmDialog` success post accion.
- Listado y filtros ocultos durante accion activa.
- Errores mantienen manejo actual: error inline de formulario o `Toast` de error.

## Modales reemplazados

- Crear promocion: reemplazado por panel enfocado.
- Editar promocion: reemplazado por panel enfocado.
- Desactivar promocion: reemplazado por confirmacion destructiva enfocada.

## Componentes creados/reutilizados

- Creado: `web/modules/pricing/components/PromotionFormPanel.tsx`.
- Reutilizado: `web/modules/inventory/components/FocusActionLayout.tsx`.
- Reutilizado: `web/components/design-system/confirm-dialog.tsx`.

## Archivos modificados

- `web/app/[tenant]/inventory/promotions/page.tsx`
- `web/modules/pricing/components/PromotionFormPanel.tsx`
- `openspec/changes/mejorar-focus-acciones-promociones/proposal.md`
- `openspec/changes/mejorar-focus-acciones-promociones/design.md`
- `openspec/changes/mejorar-focus-acciones-promociones/tasks.md`
- `openspec/changes/mejorar-focus-acciones-promociones/specs/promotion-action-focus-ux/spec.md`
- `docs/evidencia-qa-focus-ux-promociones.md`

## Validaciones

- `openspec.cmd validate mejorar-focus-acciones-promociones --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 17 items.
- `cd web && npm.cmd run build`: PASS con warnings existentes.
- `git diff --check`: PASS con warnings LF/CRLF.
- `git status --short`: ejecutado.

Tests especificos:

- No se encontro script de tests frontend en `web/package.json` distinto de `build`, `dev`, `start` y `lint`.

## QA manual

QA manual en navegador: PASS.

Validacion realizada por usuario en navegador local. Resultado reportado: todo funciona correctamente.

Checklist validado:

- [x] Abrir modulo Promociones.
- [x] Crear promocion.
- [x] Confirmar foco UX.
- [x] Cancelar creacion y volver al listado.
- [x] Guardar creacion.
- [x] Confirmar `Promocion creada correctamente`.
- [x] Editar promocion.
- [x] Confirmar foco UX.
- [x] Cancelar edicion y volver al listado.
- [x] Guardar edicion.
- [x] Confirmar `Promocion actualizada correctamente`.
- [x] Desactivar promocion de prueba.
- [x] Confirmar panel destructivo enfocado.
- [x] Confirmar `Promocion desactivada correctamente`.
- [x] Validar mobile.

## Confirmaciones

- No PRD.
- No SQL.
- No permisos ni guards.
- No deploy.
- No commit.
- No `git add .`.
