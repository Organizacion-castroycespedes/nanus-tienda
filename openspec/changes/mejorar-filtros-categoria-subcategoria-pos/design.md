## Context

`web/modules/pos/components/PosScreen.tsx` carga productos, categorias y subcategorias para el POS. La busqueda de texto y el filtro de stock se aplican en el componente, y la clasificacion usa `filterPosProductsByClassification` en `web/modules/pos/utils/product-classification.ts`.

El estado actual ya tiene `selectedProductCategoryId` y `selectedProductSubcategoryId`, y limpia la subcategoria cuando no pertenece a la categoria seleccionada. El punto debil esta en la comparacion directa de IDs del helper: si el payload de producto trae espacios, valores nulos, campos alternos tipo `category_id`/`subcategory_id`, o formas anidadas, el filtro puede dejar pasar o excluir productos incorrectos. La mejora debe robustecer esa normalizacion sin cambiar el contrato de venta.

La UI actual muestra los selectores de categoria y subcategoria en un bloque visible grande debajo de diagnostico/perifericos. Ese bloque compite con el grid de productos, sobre todo en escritorio con carrito lateral y en movil.

## Goals / Non-Goals

**Goals:**

- Hacer que categoria, subcategoria, busqueda y stock se combinen con semantica AND.
- Normalizar IDs de producto y filtros antes de comparar.
- Soportar productos sin subcategoria cuando solo se filtra por categoria.
- Limpiar busqueda, categoria y subcategoria desde una accion clara.
- Mantener subcategoria sincronizada con la categoria seleccionada.
- Compactar filtros en una zona superior con boton para mostrar u ocultar opciones avanzadas.
- Mostrar resumen de filtros activos sin empujar innecesariamente el grid.
- Cubrir la logica de filtro con tests unitarios.

**Non-Goals:**

- No cambiar backend, SQL, permisos, guards, roles ni menus.
- No cambiar precios, impuestos, descuentos, stock, inventario, cobro, pedidos ni ventas.
- No cambiar payloads ni endpoints de POS.
- No agregar dependencias.
- No hacer rediseño amplio fuera del area de filtros POS.

## Decisions

### Decision: Extraer la composicion de filtros a helper testeable

La logica de clasificacion ya vive en `web/modules/pos/utils/product-classification.ts`. Se mantendra ahi y se agregara un helper que compone busqueda, stock, categoria y subcategoria. Esto permite pruebas unitarias sin renderizar todo `PosScreen.tsx`.

Alternativa considerada: dejar el filtro en `useMemo` dentro de JSX. Rechazada porque la matriz de casos QA seria mas fragil y dificil de probar.

### Decision: Normalizar IDs y aceptar campos alternos del payload

El helper resolvera IDs con prioridad por `categoryId`/`subcategoryId`, pero tambien aceptara `category_id`/`subcategory_id` y formas anidadas con `id` cuando esten presentes. Todos los valores string se trimmean antes de comparar.

Alternativa considerada: modificar el backend para forzar un unico shape. Rechazada porque el alcance prohibe backend salvo prueba fuerte del contrato roto, y el frontend puede ser tolerante sin afectar venta.

### Decision: Filtros avanzados colapsables, busqueda siempre visible

La busqueda queda en la barra superior como accion primaria. Categoria y subcategoria se mueven a un panel compacto controlado por boton `Filtros`. El resumen de filtros activos queda visible para que el operador sepa que hay restriccion aplicada aunque el panel este cerrado.

Alternativa considerada: mantener los selectores siempre visibles. Rechazada porque ya fue identificado como problema de espacio en QA.

### Decision: Mantener stock como chips compactos existentes

Los chips de stock se conservan por bajo riesgo operativo. La mejora se concentra en la clasificacion y el espacio vertical de categoria/subcategoria.

Alternativa considerada: mover stock dentro del panel colapsable. Rechazada porque cambia mas la operacion diaria y puede ocultar un control ya visible y compacto.

## Risks / Trade-offs

- [Risk] El payload real puede usar otra forma no cubierta para clasificacion. -> Mitigacion: helper centralizado con tests y extension puntual si QA encuentra otro shape.
- [Risk] Colapsar filtros puede esconder contexto. -> Mitigacion: resumen visible de categoria/subcategoria activas y texto `Filtros activos`.
- [Risk] Autofocus de busqueda puede interferir con selects. -> Mitigacion: se mantiene el enfoque solo despues de acciones explicitas ya existentes.
- [Risk] Tests unitarios no prueban visual responsive. -> Mitigacion: documentar QA manual pendiente o PASS segun validacion de navegador.

## Migration Plan

1. Crear OpenSpec y validar requisitos.
2. Robustecer helpers POS de filtrado.
3. Actualizar `PosScreen.tsx` para usar helper compuesto y UI colapsable.
4. Agregar tests unitarios de filtros POS.
5. Crear evidencia QA en `docs/`.
6. Ejecutar validaciones requeridas.

Rollback: revertir los cambios en `web/modules/pos/`, `docs/` y `openspec/changes/mejorar-filtros-categoria-subcategoria-pos/`. No hay migracion de datos.

## Open Questions

Ninguna por ahora.
