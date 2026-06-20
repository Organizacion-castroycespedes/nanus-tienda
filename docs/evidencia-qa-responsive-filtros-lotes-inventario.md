# Evidencia QA - Responsive filtros de lotes inventario

## Rama

`fix/develop/mejora-filtros-de-categoria-y-subcategoria`

## Ruta objetivo

`/00000000-0000-0000-0000-000000000001/inventory/lots`

## Ruta validada QA manual

`https://www.apptiendamanus.space/00000000-0000-0000-0000-000000000001/inventory/lots`

## Causa raiz

El bloque de filtros de `web/app/[tenant]/inventory/lots/page.tsx` usaba una grilla custom en breakpoint `xl`:

`xl:grid-cols-[1fr_220px_220px_180px_180px_180px_180px_160px_auto_auto]`

En viewports como `1342 x 802`, `xl` ya aplica, pero la suma de columnas fijas, gaps y espacio consumido por sidebar/header supera el ancho real disponible. Eso provoca overflow horizontal, controles cortados y tabla visualmente desalineada.

## Fix aplicado

- Se reemplazo la grilla fija por `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6`.
- Se agregaron wrappers `min-w-0` alrededor de inputs/selects.
- El buscador puede ocupar varias columnas sin forzar ancho fijo.
- `Buscar` y `Limpiar` viven en `flex flex-wrap`, con ancho completo en pantallas chicas.
- `Solo disponibles` mantiene texto legible con `whitespace-nowrap`.
- El contenedor raiz, la tarjeta de filtros y la tarjeta de tabla usan `min-w-0 max-w-full`.
- El scroll horizontal queda en el wrapper de tabla con `max-w-full overflow-x-auto`.

## Archivos modificados

- `web/app/[tenant]/inventory/lots/page.tsx`
- `openspec/changes/mejorar-responsive-filtros-lotes-inventario/proposal.md`
- `openspec/changes/mejorar-responsive-filtros-lotes-inventario/design.md`
- `openspec/changes/mejorar-responsive-filtros-lotes-inventario/specs/inventory-lots-responsive-filters/spec.md`
- `openspec/changes/mejorar-responsive-filtros-lotes-inventario/tasks.md`
- `docs/evidencia-qa-responsive-filtros-lotes-inventario.md`

## Validaciones tecnicas

- `openspec.cmd validate mejorar-responsive-filtros-lotes-inventario --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS.
- `cd web && npx.cmd tsx --test modules/inventory/utils/product-classification.spec.ts modules/inventory/utils/inventory-image-upload.spec.ts modules/inventory/components/purchase-receive-lines.spec.ts`: PASS, 18 tests.
- `cd web && npm.cmd run lint`: PASS con warnings preexistentes fuera de este cambio.
- `cd web && npm.cmd run build`: PASS con warnings preexistentes fuera de este cambio y aviso Browserslist.
- `git diff --check`: PASS con aviso LF/CRLF de Git.

## QA visual / manual

Resultado QA manual: PASS.

Validacion visual:

- La seccion de filtros ya no se desborda horizontalmente.
- Los campos de filtro permanecen visibles dentro del contenedor.
- Los botones `Buscar` y `Limpiar` quedan accesibles.
- El selector de filas no queda cortado.
- La tabla conserva usabilidad sin provocar overflow horizontal global.
- La experiencia visual mejora en viewport responsive.

## Criterio de aceptacion

PASS: los filtros se acomodan dentro del ancho disponible y no generan mala experiencia visual por desbordamiento.

## Confirmaciones de alcance

- Fix visual responsive.
- No backend.
- No SQL.
- No migraciones.
- No contratos API.
- No permisos/guards.
- No reglas de negocio de lotes.
- No cambios en vencimientos, stock disponible ni discrepancias.
- No cambios funcionales en semantica de filtros.

## Estado final

PASS tecnico + QA MANUAL PASS.
