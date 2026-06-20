## Context

`web/modules/pos/components/PosScreen.tsx` renderiza el catalogo POS con un unico grid de tarjetas. El componente ya conserva busqueda, filtros de categoria/subcategoria, filtros de stock, estado de carrito y accion de agregar producto. La mejora debe cambiar solo la presentacion visual del listado de productos, sin tocar el contrato de datos ni reglas de venta.

El cambio vive en frontend POS. La vista actual de cuadrícula debe quedar como default. La vista lista debe reutilizar la misma informacion y handlers del card actual para evitar divergencias entre modos.

## Goals / Non-Goals

**Goals:**

- Agregar estado local `productViewMode: "grid" | "list"` con default `"grid"`.
- Agregar un segmented control accesible cerca de los chips de stock.
- Renderizar productos en grid o lista usando los mismos datos filtrados.
- Reutilizar las mismas reglas de disabled y accion de agregar producto.
- Mantener badges de stock, producto en carrito, unidad, precio final e imagen/iniciales.
- Evitar overflow horizontal en mobile, tablet y desktop.
- Documentar QA manual.

**Non-Goals:**

- No persistir si no hay patron claro de localStorage especifico de POS para esta preferencia.
- No modificar backend, SQL, API, permisos, guards ni roles.
- No modificar logica de venta, carrito, cobro, precios, descuentos, impuestos, stock, balanza, scanner ni perifericos.
- No agregar dependencias.

## Decisions

### Decision: Estado local sin persistencia

No se encontro un patron claro de localStorage dentro del POS para preferencias visuales del catalogo. Se usara `useState` local con default `"grid"` para evitar deuda adicional y no mezclar tenant/session storage con comportamiento visual nuevo.

Alternativa considerada: persistir con `pos:product-view-mode:{tenantId}`. Rechazada por ahora porque el alcance permite estado local si no existe patron equivalente en POS y el default debe conservar la UX actual.

### Decision: Un solo mapa de productos con ramas visuales

Se calcularan los mismos valores por producto (`stock`, `productSaleType`, `requiresScale`, `quantityInCart`, `effectiveImage`) y se renderizara card de grid o row de lista segun el modo activo. Asi el boton de agregar, disabled por stock/permisos/balanza y el indicador de carrito quedan alineados en ambos modos.

Alternativa considerada: duplicar todo el render con dos mapas separados. Rechazada porque aumenta el riesgo de divergencia en reglas de disabled y contenido visible.

### Decision: Control segmentado con iconos y texto

El selector usara botones nativos con `aria-pressed`, iconos de `lucide-react` y texto visible `Cuadricula` / `Lista`. Esto mantiene acceso por teclado, foco visible del sistema de clases existente y estado activo evidente.

Alternativa considerada: icon-only buttons. Rechazada porque el requerimiento pide labels claros y el espacio disponible permite texto compacto.

### Decision: Lista como card horizontal responsive

La vista lista sera una columna de botones/cards horizontales con imagen a la izquierda, informacion central y precio/accion a la derecha. En mobile se permitira wrap interno y el precio/accion bajaran si el ancho no alcanza, sin crear overflow global.

Alternativa considerada: tabla. Rechazada porque el POS actual usa botones/cards accionables y la tabla haria mas probable romper touch targets y responsive.

## Risks / Trade-offs

- [Risk] Duplicacion visual parcial entre grid y lista. -> Mitigacion: mantener valores y clases clave compartidas dentro del mismo map.
- [Risk] El texto largo de producto puede romper filas en mobile. -> Mitigacion: usar `min-w-0`, `truncate`/`line-clamp` y wrap controlado.
- [Risk] Tests frontend de componentes POS no estan cableados. -> Mitigacion: ejecutar lint/build disponibles y registrar QA manual.
- [Risk] No persistir preferencia puede sorprender a usuarios frecuentes. -> Mitigacion: documentar decision; default grid cumple criterio de no romper UX.

## Migration Plan

1. Crear artefactos OpenSpec.
2. Agregar estado local y control segmentado en `PosScreen.tsx`.
3. Implementar render lista con los mismos handlers y reglas del grid.
4. Crear evidencia QA.
5. Ejecutar validaciones OpenSpec y web disponibles.

Rollback: revertir cambios en `web/modules/pos/components/PosScreen.tsx`, `docs/evidencia-qa-vista-productos-pos-grid-lista.md` y `openspec/changes/mejorar-vista-productos-pos-grid-lista/`. No hay migracion de datos.

## Open Questions

Ninguna por ahora.
