# Evidencia QA - Estado activo boton Filtros POS

## Rama

`fix/develop/mejora-filtros-de-categoria-y-subcategoria`

## HEAD inicial

`2ffc85d`

## Ruta objetivo

`http://localhost:3000/00000000-0000-0000-0000-000000000001/pos`

## Causa raiz visual

El boton `Filtros` usaba `variant="outline"` aun cuando habia filtros activos. Ese variant inyecta clases de color como `bg-white text-slate-900`. El estado activo agregaba otras clases como `text-white`.

Tailwind puede resolver clases del mismo grupo por orden del CSS generado. En QA esto produjo una combinacion mala: fondo blanco del variant con texto/iconos blancos del estado activo. El boton quedaba como rectangulo blanco o vacio.

## Fix aplicado

- Con filtros activos, el boton `Filtros` usa `variant="primary"`.
- Sin filtros activos, mantiene `variant="outline"`.
- El estado activo ya no mezcla `outline` con texto blanco.
- Se mantiene el contenido del boton:
  - icono `SlidersHorizontal`
  - texto `Filtros`
  - badge con cantidad de filtros activos
  - chevron
- El cambio queda localizado en `web/modules/pos/components/PosScreen.tsx`.

## Archivos modificados por este hotfix

- `web/modules/pos/components/PosScreen.tsx`
- `docs/evidencia-qa-pos-filter-button-active-state.md`
- `openspec/changes/corregir-estado-visual-boton-filtros-pos/proposal.md`
- `openspec/changes/corregir-estado-visual-boton-filtros-pos/design.md`
- `openspec/changes/corregir-estado-visual-boton-filtros-pos/specs/pos-filter-button-visual-state/spec.md`
- `openspec/changes/corregir-estado-visual-boton-filtros-pos/tasks.md`

## QA manual sugerido

1. Entrar al POS sin filtros.
2. Confirmar boton `Filtros` con icono, texto y chevron.
3. Abrir filtros.
4. Aplicar `Categoria: Lacteos`.
5. Confirmar chip `Categoria: Lacteos`.
6. Confirmar boton `Filtros` visible y legible, con badge.
7. Probar hover/focus.
8. Usar `Limpiar filtros`.
9. Confirmar retorno al estado normal.

## QA visual en esta sesion

No completado. Se intento abrir la ruta local con in-app Browser, pero el runtime fallo con:

`windows sandbox failed: spawn setup refresh`

Playwright local no esta instalado en `web/node_modules`, asi que no hubo fallback de navegador local.

## Validaciones ejecutadas

- `openspec.cmd validate --all --strict`: PASS inicial.
- `openspec.cmd validate corregir-estado-visual-boton-filtros-pos --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS.
- `cd web && npx.cmd tsx --test modules/pos/utils/product-classification.spec.ts`: PASS, 11 tests.
- `cd web && npm.cmd run lint`: PASS con warnings preexistentes fuera de POS.
- `cd web && npm.cmd run build`: PASS con warnings preexistentes fuera de POS y aviso Browserslist.
- `git diff --check`: PASS con avisos LF/CRLF de Git.

## Confirmaciones de alcance

- No backend.
- No SQL.
- No permisos/guards.
- No logica POS.
- No carrito.
- No ventas.
- No pricing/impuestos/stock/promociones.
- No Home publico.

## Estado final

- PASS tecnico.
- QA manual visual pendiente en navegador real.
