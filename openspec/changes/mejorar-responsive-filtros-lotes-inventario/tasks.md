## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git rev-parse --abbrev-ref HEAD`.
- [x] 1.3 Ejecutar `git rev-parse --short HEAD`.
- [x] 1.4 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 1.5 Localizar vista `web/app/[tenant]/inventory/lots/page.tsx`.
- [x] 1.6 Identificar layout rigido de filtros y wrapper de tabla.

## 2. OpenSpec

- [x] 2.1 Crear change `mejorar-responsive-filtros-lotes-inventario`.
- [x] 2.2 Crear proposal.
- [x] 2.3 Crear design.
- [x] 2.4 Crear spec.
- [x] 2.5 Validar change en strict.
- [x] 2.6 Validar OpenSpec completo en strict.

## 3. Implementacion

- [x] 3.1 Reemplazar grilla custom fija de filtros por layout responsive fluido.
- [x] 3.2 Agregar `min-w-0`, `w-full` o equivalentes en controles/wrappers necesarios.
- [x] 3.3 Agrupar acciones `Buscar` y `Limpiar` con wrap visible.
- [x] 3.4 Mantener `Solo disponibles` legible.
- [x] 3.5 Asegurar tabla con scroll horizontal interno sin overflow global.
- [x] 3.6 No tocar semantica de filtros ni reglas de inventario/lotes.

## 4. Validacion

- [x] 4.1 Ejecutar tests frontend relacionados si existen.
- [x] 4.2 Ejecutar `cd web && npm.cmd run lint`.
- [x] 4.3 Ejecutar `cd web && npm.cmd run build`.
- [x] 4.4 Ejecutar `git diff --check`.
- [x] 4.5 Validar o documentar QA visual en 1342x802, 1024x768, 768x1024 y 390x844.
- [x] 4.6 Reportar `git status --short` final.

## 5. QA Manual

- [x] 5.1 Validar ruta `https://www.apptiendamanus.space/00000000-0000-0000-0000-000000000001/inventory/lots`.
- [x] 5.2 Confirmar que filtros no se desbordan horizontalmente.
- [x] 5.3 Confirmar que campos de filtro permanecen visibles dentro del contenedor.
- [x] 5.4 Confirmar que botones `Buscar` y `Limpiar` quedan accesibles.
- [x] 5.5 Confirmar que selector de filas no queda cortado.
- [x] 5.6 Confirmar que tabla conserva usabilidad sin overflow horizontal global.
- [x] 5.7 Confirmar alcance visual responsive sin cambios backend, SQL, API, permisos/guards ni reglas de negocio.
- [x] 5.8 Registrar resultado QA manual: PASS.
