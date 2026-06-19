# Evidencia QA - Filtros categoria/subcategoria POS

## Rama usada

`fix/develop/mejora-filtros-de-categoria-y-subcategoria`

## Ruta probada / objetivo

- QA reportada: `https://www.apptiendamanus.space/00000000-0000-0000-0000-000000000001/pos`
- Ruta validada manualmente: `/00000000-0000-0000-0000-000000000001/pos`

## Causa raiz

El filtro de clasificacion POS dependia de una comparacion directa contra `product.categoryId` y `product.subcategoryId` dentro de `filterPosProductsByClassification`. Si el payload del producto venia con espacios, campos alternos como `category_id`/`subcategory_id`, o forma anidada con `id`, la comparacion podia no coincidir con la categoria seleccionada.

La composicion de busqueda, stock y clasificacion tambien estaba embebida en `PosScreen.tsx`, lo que hacia mas dificil cubrir los casos QA con tests unitarios.

## Archivos modificados

- `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/proposal.md`
- `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/design.md`
- `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/specs/pos-product-filters/spec.md`
- `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/tasks.md`
- `web/modules/pos/utils/product-classification.ts`
- `web/modules/pos/utils/product-classification.spec.ts`
- `web/modules/pos/components/PosScreen.tsx`
- `docs/evidencia-qa-filtros-categoria-subcategoria-pos.md`

## Comportamiento antes

- Categoria y subcategoria se comparaban con IDs directos del producto.
- El filtro podia fallar si el producto no usaba exactamente `categoryId`/`subcategoryId`.
- Los selectores de categoria/subcategoria estaban siempre visibles en un bloque que consumia espacio vertical.
- La accion de limpiar solo limpiaba clasificacion, no la busqueda.

## Comportamiento despues

- El helper POS normaliza IDs antes de comparar.
- El helper acepta `categoryId`, `category_id`, `productCategoryId`, `categoriaId`, `category.id` y equivalentes de subcategoria.
- Busqueda, stock, categoria y subcategoria se combinan con semantica AND.
- Productos sin subcategoria siguen visibles cuando solo se filtra por categoria.
- Al cambiar categoria, una subcategoria ajena se limpia.
- `Limpiar filtros` restablece busqueda, categoria y subcategoria.
- La busqueda queda visible arriba con boton `Filtros`.
- Categoria y subcategoria viven en un panel colapsable.
- El resumen compacto muestra busqueda/categoria/subcategoria activas.
- No se toco backend, SQL, permisos, precios, impuestos, descuentos, stock, cobro, pedidos ni ventas.

## Casos QA funcionales

| Caso | Resultado |
| --- | --- |
| Filtra por categoria | PASS unitario |
| Filtra por subcategoria | PASS unitario |
| Combina busqueda + categoria | PASS unitario |
| Reset de subcategoria al cambiar categoria | PASS unitario |
| Limpiar filtros | PASS unitario |
| Productos sin subcategoria | PASS unitario |
| Filtro por categoria en POS | QA MANUAL PASS |
| Filtro por subcategoria en POS | QA MANUAL PASS |
| Busqueda combinada con categoria/subcategoria | QA MANUAL PASS |
| Limpiar filtros | QA MANUAL PASS |
| Panel mostrar/ocultar filtros | QA MANUAL PASS |
| Experiencia visual compacta | QA MANUAL PASS |
| Responsive/movil | QA MANUAL PASS |
| No regresion en flujo POS | QA MANUAL PASS |

## Validaciones ejecutadas

- `openspec.cmd validate mejorar-filtros-categoria-subcategoria-pos --type change --strict`: PASS
- `openspec.cmd validate --all --strict`: PASS
- `cd web && npx.cmd tsx --test modules/pos/utils/product-classification.spec.ts`: PASS, 11 tests
- `cd web && npm.cmd run lint`: PASS con warnings preexistentes fuera de POS
- `cd web && npm.cmd run build`: PASS con warnings preexistentes fuera de POS y aviso Browserslist
- `git diff --check`: PASS con avisos de fin de linea LF/CRLF de Git

## QA visual / navegador

QA visual/manual ejecutado sobre la ruta:

`/00000000-0000-0000-0000-000000000001/pos`

Resultado: QA MANUAL PASS.

Validaciones manuales registradas:

- Filtro por categoria: PASS.
- Filtro por subcategoria: PASS.
- Busqueda combinada con categoria/subcategoria: PASS.
- Limpiar filtros: PASS.
- Panel o bloque mostrar/ocultar filtros: PASS.
- Experiencia visual compacta: PASS.
- Responsive/movil: PASS.
- No regresion en flujo POS: productos, carrito, precios, descuentos, stock, cobro y venta sin cambios funcionales.

## Estado final

- PASS tecnico: OpenSpec, tests POS, lint, build y diff check pasan.
- QA MANUAL PASS: filtros de categoria/subcategoria, busqueda combinada, limpieza, panel colapsable, experiencia compacta, responsive/movil y no regresion POS.
