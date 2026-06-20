## 1. Discovery

- [x] 1.1 Confirmar rama activa y `git status --short` antes de modificar.
- [x] 1.2 Revisar `web/modules/pos/components/PosScreen.tsx`.
- [x] 1.3 Revisar helpers POS de clasificacion y tests existentes.
- [x] 1.4 Identificar frontera para no tocar backend, SQL ni logica de venta.

## 2. OpenSpec

- [x] 2.1 Crear change `mejorar-filtros-categoria-subcategoria-pos`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear spec `pos-product-filters`.
- [x] 2.5 Validar OpenSpec change en modo strict.
- [x] 2.6 Validar OpenSpec completo en modo strict.

## 3. Implementacion

- [x] 3.1 Robustecer helper POS para normalizar IDs de categoria/subcategoria del producto y filtros.
- [x] 3.2 Extraer helper testeable para combinar busqueda, stock, categoria y subcategoria.
- [x] 3.3 Actualizar `PosScreen.tsx` para usar el helper compuesto.
- [x] 3.4 Compactar UX de filtros con boton `Filtros`, panel colapsable, resumen activo y accion `Limpiar filtros`.
- [x] 3.5 Mantener intactos carrito, precios, impuestos, descuentos, stock, cobro, pedidos y ventas.

## 4. Tests

- [x] 4.1 Agregar tests para filtro por categoria.
- [x] 4.2 Agregar tests para filtro por subcategoria.
- [x] 4.3 Agregar tests para busqueda combinada con categoria.
- [x] 4.4 Agregar tests para reset de subcategoria al cambiar categoria.
- [x] 4.5 Agregar tests para limpiar filtros.
- [x] 4.6 Agregar tests para productos sin subcategoria.
- [x] 4.7 Ejecutar tests frontend relacionados con POS/filtros.

## 5. Evidencia y Validacion

- [x] 5.1 Crear evidencia QA en `docs/evidencia-qa-filtros-categoria-subcategoria-pos.md`.
- [x] 5.2 Ejecutar `cd web && npm.cmd run lint`.
- [x] 5.3 Ejecutar `cd web && npm.cmd run build`.
- [x] 5.4 Ejecutar `git diff --check`.
- [x] 5.5 Reportar `git status --short` final.

## 6. QA Manual

- [x] 6.1 Validar visual/manual en `/00000000-0000-0000-0000-000000000001/pos`.
- [x] 6.2 Validar filtro por categoria: PASS.
- [x] 6.3 Validar filtro por subcategoria: PASS.
- [x] 6.4 Validar busqueda combinada con categoria/subcategoria: PASS.
- [x] 6.5 Validar limpiar filtros: PASS.
- [x] 6.6 Validar mostrar/ocultar panel de filtros: PASS.
- [x] 6.7 Validar experiencia visual compacta: PASS.
- [x] 6.8 Validar responsive/movil: PASS.
- [x] 6.9 Validar no regresion POS en productos, carrito, precios, descuentos, stock, cobro y venta.
