## Why

El modulo POS actual contiene informacion util para operar, pero la venta no esta suficientemente priorizada a nivel visual. El buscador, Scanner MOCK/SIMULATOR, Balanza MOCK, filtros, grilla y carrito compiten por espacio vertical, lo que genera scroll innecesario y reduce velocidad en caja.

Durante QA manual se detectaron tres regresiones funcionales que forman parte del mismo cambio:

- el carrito POS puede quedar inaccesible en resoluciones pequeñas,
- el menu responsive pierde labels solamente desde `/pos`,
- el contexto POS de usuario, terminal y sucursal no aparece en el header global hasta entrar a `/pos`.

El objetivo es redisenar la experiencia POS alrededor de un flujo venta-first y, al mismo tiempo, corregir esas regresiones operativas sin introducir hacks visuales ni estados duplicados.

## What Changes

- Introducir un layout POS enfocado en venta diaria.
- Ubicar el buscador de productos como control principal y mantener autofocus operativo.
- Mantener el carrito siempre visible o accesible como panel lateral sticky, drawer o bottom sheet segun viewport.
- Compartir un unico estado funcional para abrir y cerrar el carrito responsive desde cabecera, floating action y POS.
- Compactar usuario actual, estado de venta y cliente en una barra de contexto.
- Resolver y mostrar el contexto POS global en el header cuando exista una sesion valida, sin depender de montar `PosScreen`.
- Mostrar filtros de productos como chips compactos con contador.
- Modernizar tarjetas de producto para priorizar nombre, SKU/codigo, unidad, precio, stock y accion rapida.
- Reubicar Scanner MOCK/SIMULATOR y Balanza MOCK en una barra contextual compacta y panel diagnostico colapsable.
- Ocultar o colapsar controles MOCK por defecto en operacion normal.
- Mantener la paleta visual actual y reutilizar componentes de `web/components/design-system`.
- Mejorar operacion por teclado cuando no interfiera con inputs normales.
- Documentar la guia visual en `docs/pos-visual-experience.md`.
- Mantener impuestos, descuentos, inventario, pagos/cobro y contratos sin cambios funcionales.

## Capabilities

### New Capabilities

- `pos`: Cubre la experiencia visual y operativa del modulo POS, incluyendo layout venta-first, buscador principal, carrito persistente, filtros compactos, tarjetas de producto, perifericos colapsables, responsive Web/Electron/Capacitor y operacion por teclado.

### Modified Capabilities

- Ninguna. No se modifican requisitos existentes archivados; esta propuesta agrega una capacidad POS formal para el rediseño visual y operativo.

## Impact

- Afecta principalmente `web/modules/pos/components/PosScreen.tsx`.
- Puede requerir ajustes puntuales en `web/app/[tenant]/layout.tsx` y `web/app/providers.tsx` para compartir el contexto POS y el carrito responsive.
- Puede agregar componentes visuales POS bajo `web/modules/pos/components/`.
- Agrega documentacion en `docs/pos-visual-experience.md`.
- Agrega artefactos OpenSpec en `openspec/changes/pos-visual-operability-redesign/`.
- No cambia rutas Next.js, endpoints API, payloads de venta, calculos fiscales, descuentos, reglas de inventario ni persistencia del carrito.
- No introduce dependencias nuevas.
- Mantiene compatibilidad con Web, Electron y Capacitor mediante CSS responsive y safe area.
