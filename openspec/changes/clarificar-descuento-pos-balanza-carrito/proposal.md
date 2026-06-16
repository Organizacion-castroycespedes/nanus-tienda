## Why

En el carrito POS, el texto de descuento de una linea con promocion muestra hoy el ahorro total como `Descuento $ X (Y%)`.

Para productos vendidos por balanza o con cantidades distintas de 1, ese texto queda ambiguo. El usuario puede interpretar que `$ X` es descuento unitario, aunque el valor realmente sea el ahorro total de la linea.

Ejemplo observado:

- Producto: Cafe
- Cantidad/peso: 1.25
- Precio base unitario: $4.000
- Precio promocional unitario: $3.600
- Ahorro unitario: $400
- Ahorro total: $500

El carrito muestra `Descuento $ 500 (10%)`, que no deja claro que `$500` es ahorro total.

## What Changes

- Ajustar solo la presentacion del texto de descuento en el carrito POS.
- Para cantidad 1 mantener texto compacto: `Descuento $ 400 (10%)`.
- Para cantidad distinta de 1, cantidad decimal o producto de balanza, mostrar descuento unitario y ahorro total: `Descuento $ 400 c/u  Ahorro total $ 500 (10%)`.
- Evitar mostrar `NaN`, `undefined`, `null`, valores negativos o porcentajes inventados.
- Mantener calculos actuales de total de linea, impuestos, stock, promociones y venta POS.

## Out of Scope

- Cambios de backend o contratos API.
- Cambios SQL o migraciones.
- Cambios de stock, facturacion, pedidos, caja o persistencia.
- Refactor amplio de POS.
- Cambios de permisos o guards.
