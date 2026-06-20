## 1. Discovery

- [x] 1.1 Confirmar rama activa y `git status --short` antes de modificar.
- [x] 1.2 Revisar componente actual de POS donde se renderizan productos.
- [x] 1.3 Identificar estado actual de busqueda, filtros, cards y carrito.
- [x] 1.4 Confirmar que el alcance queda limitado a frontend POS y documentacion QA.

## 2. OpenSpec

- [x] 2.1 Crear change `mejorar-vista-productos-pos-grid-lista`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear spec `pos-product-list-layout`.
- [x] 2.5 Validar OpenSpec change en modo strict.
- [x] 2.6 Validar OpenSpec completo en modo strict.

## 3. Implementacion

- [x] 3.1 Agregar estado `productViewMode: "grid" | "list"` con default `grid`.
- [x] 3.2 Agregar control visual `Cuadricula` / `Lista` cerca de los filtros de productos.
- [x] 3.3 Mantener layout de cuadrícula actual sin cambios funcionales.
- [x] 3.4 Implementar layout lista con fila/card horizontal responsive.
- [x] 3.5 Reutilizar reglas existentes de disabled, stock, producto en carrito, pesables y accion agregar.
- [x] 3.6 Verificar que cambio de vista no modifica busqueda, filtros, stock filter ni carrito.

## 4. Tests y Validacion Web

- [x] 4.1 Revisar si existen tests frontend aplicables para el componente POS.
- [x] 4.2 Ejecutar tests frontend relacionados si existen.
- [x] 4.3 Ejecutar `cd web && npm.cmd run lint`.
- [x] 4.4 Ejecutar `cd web && npm.cmd run build`.
- [x] 4.5 Ejecutar `git diff --check`.

## 5. Evidencia QA Manual

- [x] 5.1 Crear `docs/evidencia-qa-vista-productos-pos-grid-lista.md`.
- [x] 5.2 Documentar rama, ruta y tenant probado.
- [x] 5.3 Documentar vista cuadrícula default PASS.
- [x] 5.4 Documentar cambio a lista PASS.
- [x] 5.5 Documentar cambio de lista a cuadrícula PASS.
- [x] 5.6 Documentar filtros conservados PASS.
- [x] 5.7 Documentar carrito conservado PASS.
- [x] 5.8 Documentar agregar producto en cuadrícula PASS.
- [x] 5.9 Documentar agregar producto en lista PASS.
- [x] 5.10 Documentar producto sin stock visible correctamente PASS.
- [x] 5.11 Documentar responsive desktop y movil/tablet PASS si se valida.
- [x] 5.12 Documentar sin backend/SQL/API/permisos PASS.

## 6. Cierre

- [x] 6.1 Revisar diff final.
- [x] 6.2 Reportar `git status --short` final.

## 7. QA Manual Final

- [x] 7.1 Registrar QA visual/manual PASS en `docs/evidencia-qa-vista-productos-pos-grid-lista.md`.
- [x] 7.2 Confirmar selector `Cuadricula / Lista` visible: PASS.
- [x] 7.3 Confirmar default en `Cuadricula`: PASS.
- [x] 7.4 Confirmar cambio a `Lista` y regreso a `Cuadricula`: PASS.
- [x] 7.5 Confirmar filtros y carrito conservados al cambiar vista: PASS.
- [x] 7.6 Confirmar agregar producto en `Cuadricula` y `Lista`: PASS.
- [x] 7.7 Confirmar reglas de stock, carrito, pesables y agregar sin regresion: PASS.
- [x] 7.8 Confirmar responsive visual: PASS.
- [x] 7.9 Confirmar sin backend, SQL, contratos API, permisos ni guards: PASS.
