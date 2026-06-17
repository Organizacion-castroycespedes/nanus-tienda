# POS Visual Experience

Esta guia define la intencion visual obligatoria para el rediseño `pos-visual-operability-redesign`.

## Principios

- Venta como foco principal.
- Buscador visible y prioritario.
- Carrito siempre visible o accesible.
- Total final siempre accesible.
- Perifericos compactos.
- Scanner/Balanza MOCK solo en diagnostico, desarrollo o flag.
- Tarjetas de producto modernas y compactas.
- Accion Cobrar como CTA principal.
- Uso obligatorio del design-system existente cuando exista equivalente.
- Mantener paleta actual: fondo claro, cards blancas, bordes suaves, azul primario, verde para OK, rojo/naranja para alertas y navy/oscuro para activos.

## Estado 1: POS desktop venta-first

```text
+----------------------------------------------------------------------------------+
| Sistema / Punto de venta       [ Buscar productos por nombre, SKU o codigo ]      |
+----------------------------------------------------------------------------------+
| Usuario actual | Estado venta | Cliente                                           |
|----------------------------------------------------------------------------------|
| [Todos 7] [Con stock 7] [Stock bajo 2] [Sin stock 0]                    [Filtro] |
|----------------------------------------------------------------------------------|
| Producto | Producto | Producto                                 | Carrito sticky |
| Producto | Producto | Producto                                 | Total / Cobrar  |
|----------------------------------------------------------------------------------|
| Scanner compacto | Balanza compacta | Sync                                      |
+----------------------------------------------------------------------------------+
```

Expectativa:

- El operador puede buscar o escanear sin scroll.
- La grilla tiene prioridad visual.
- Los datos de usuario, estado y cliente no consumen una fila grande.
- El carrito lateral no tapa el catalogo.

## Estado 2: POS con carrito lateral sticky

```text
Carrito de venta
  Item
    nombre, SKU
    cantidad editable
    precio unitario
    descuento si aplica
    total linea
    impuestos colapsados

Resumen
  Subtotal
  Impuestos
  Descuentos aplicados
  Total final

[ COBRAR $ 9.180 ]
```

Expectativa:

- El total final queda visible.
- Cobrar es la accion primaria mas fuerte.
- Impuestos por item existen, pero colapsados por defecto.
- La venta actual no se pierde al cambiar filtros.

## Estado 3: POS con perifericos colapsados

```text
Barra compacta:
  Scanner desconectado
  Balanza desconectada
  Ver diagnostico
```

Expectativa:

- Scanner MOCK/SIMULATOR y Balanza MOCK no son tarjetas grandes.
- Si estan desconectados, no desplazan productos ni carrito.
- El panel diagnostico se expande solo por accion secundaria.
- Los controles MOCK aparecen solo con `NEXT_PUBLIC_POS_MOCK_DEVICES=true`, entorno de desarrollo, diagnostico o feature flag existente.

## Estado 4: Producto pesable y balanza conectada

```text
Tarjeta:
  Cafe
  678624254445
  Peso / KG
  $ 4.000
  [Leer balanza]

Carrito:
  Cafe
  0.350 KG
  $ 4.000 / KG
  Total linea: $ 1.400
```

Expectativa:

- Producto pesable muestra accion contextual.
- La accion de balanza no invade productos no pesables.
- Si la balanza falla, se muestra feedback controlado y el POS manual sigue operativo.

## Estado 5: POS mobile / Capacitor

```text
[ Buscar productos ]
[ Usuario | Estado | Cliente ]
[ Filtros compactos ]
[ Producto ]
[ Producto ]

[ Carrito: 3 items - $ 24.500 ]  <- bottom bar

Bottom sheet:
  items
  resumen
  [ COBRAR ]
```

Expectativa:

- El buscador se mantiene arriba.
- La grilla usa 1 columna, o 2 si el ancho lo permite.
- El carrito abre con una accion.
- El bottom sheet respeta `env(safe-area-inset-bottom)`.
- Perifericos quedan colapsados.

## Diferencias permitidas frente a la referencia visual

- El sistema actual no tiene imagenes de producto garantizadas; se pueden usar iniciales o placeholder visual.
- El design-system actual no incluye `Card`, `Badge`, `Drawer` o `Sheet`; se permite markup POS-local con clases del sistema.
- El header global real puede diferir del mock, pero el buscador POS debe quedar en posicion prioritaria.
- Si no hay Storybook/Ladle/demo visual, los mockups quedan documentados en Markdown.
