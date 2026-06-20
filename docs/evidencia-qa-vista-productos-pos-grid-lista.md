# Evidencia QA - Vista productos POS grid/lista

## Contexto

- Rama usada: `feat/develop/mejora-visual-modulo-de-pos`
- Commit base: `b585757`
- Ruta probada: `/00000000-0000-0000-0000-000000000001/pos`
- URL local probada: `http://localhost:3000/00000000-0000-0000-0000-000000000001/pos`
- Tenant probado: `00000000-0000-0000-0000-000000000001`
- Actor QA: `SUPER_USER` local con caja POS abierta existente.
- Navegador QA: Edge headless via CDP.
- Capturas temporales revisadas durante QA, no versionadas:
  - `.qa-pos-grid-desktop.png`
  - `.qa-pos-list-desktop.png`
  - `.qa-pos-list-mobile-products.png`

## Resultado funcional

| Caso | Resultado |
| --- | --- |
| Vista cuadrícula default | PASS. Selector presente, `Cuadricula` inicia con `aria-pressed=true`; se renderizaron 7 productos. |
| Cambio a lista | PASS. `Lista` cambia a `aria-pressed=true`; se renderizaron 7 filas/lista. |
| Cambio de lista a cuadrícula | PASS. `Cuadricula` vuelve a `aria-pressed=true`. |
| Filtros conservados | PASS. Chips `Todos`, `Con stock`, `Stock bajo`, `Sin stock` permanecieron visibles y no se limpiaron al alternar vista. |
| Carrito conservado | PASS. Producto agregado en cuadrícula siguió visible en carrito al cambiar a lista y volver a cuadrícula. |
| Agregar producto en cuadrícula | PASS. Click en producto habilitado agregó item al carrito. |
| Agregar producto en lista | PASS. Click en producto habilitado en lista mantuvo/agregó item al carrito. |
| Producto sin stock visible correctamente | PASS por verificación de código: ambos layouts reutilizan `stock <= 0`, `getProductStockTone(stock)` y el disabled existente. Fixture local actual tiene `Sin stock 0`, por eso no hubo producto real sin stock para captura visual. |
| Responsive desktop | PASS. `scrollWidth` no superó `clientWidth`; carrito lateral intacto. |
| Responsive móvil/tablet | PASS. Viewport `390x844`, lista ocupa ancho disponible, `scrollWidth=390`, sin overflow horizontal global. |
| Sin backend/SQL/API/permisos | PASS. Diff limitado a frontend POS, OpenSpec y docs QA. No se modificaron contratos, SQL, backend, permisos, guards ni roles. |

## QA manual final

| Caso manual | Resultado |
| --- | --- |
| Ruta probada `http://localhost:3000/00000000-0000-0000-0000-000000000001/pos` | PASS |
| QA visual/manual | PASS |
| Selector `Cuadricula / Lista` visible | PASS |
| Default en `Cuadricula` | PASS |
| Cambio a `Lista` | PASS |
| Cambio de `Lista` a `Cuadricula` | PASS |
| Filtros se conservan al cambiar vista | PASS |
| Carrito se conserva al cambiar vista | PASS |
| Agregar producto en `Cuadricula` | PASS |
| Agregar producto en `Lista` | PASS |
| Reglas de stock, carrito, pesables y agregar sin regresion | PASS |
| Responsive visual | PASS |
| Sin backend | PASS |
| Sin SQL | PASS |
| Sin contratos API | PASS |
| Sin permisos/guards | PASS |

## Validaciones automatizadas

- `openspec.cmd validate mejorar-vista-productos-pos-grid-lista --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS.
- `cd web && npx.cmd tsx --test modules\pos\utils\*.spec.ts`: PASS, 11 tests.
- `cd web && npm.cmd run lint`: PASS con warnings preexistentes fuera del cambio.
- `cd web && npm.cmd run build`: PASS con warnings preexistentes fuera del cambio.
- `git diff --check`: PASS.

## Notas

- No se persistió `productViewMode` en `localStorage`; POS tiene persistencia de contexto/carrito, pero no se encontró patrón equivalente para preferencias visuales. Se dejó estado local con default `grid` para no introducir deuda innecesaria.
- Fixture local reporta `Sin stock 0`; no habia producto real sin stock disponible para captura manual.
- El codigo mantiene estado `Sin stock` y disabled igual en ambos modos segun validacion tecnica.
- Estado final: implementacion local completa, QA tecnico PASS y QA visual/manual PASS.
- No hay commit todavia.
