## Approach

El cambio se limita al frontend POS.

La fuente de datos actual ya contiene los valores necesarios en `PosCartItem` y en los valores derivados del carrito:

- `baseUnitPrice`
- `finalUnitPrice` / `unitPrice`
- `discountAmount`
- `discountPercent`
- `quantity`
- `discountTotal`
- indicador local de producto de balanza mediante `isWeighableProduct(product)`

Se extrae una funcion pequena y testeable para construir las partes visibles del descuento. La funcion no recalcula totales de venta ni impuestos; solo decide como presentar datos ya calculados.

## Display Rules

- Si no hay descuento valido, no se muestra texto.
- Si la cantidad es 1 y el producto no requiere detalle de cantidad, se mantiene el formato compacto.
- Si la cantidad es distinta de 1, decimal o producto de balanza, se muestra:
  - descuento unitario
  - ahorro total de linea
  - porcentaje solo si ya existe y es valido
- La funcion usa valores finitos y positivos. Si algun valor falta, usa fallback seguro sin mostrar datos corruptos.

## Files

- `web/modules/pos/components/pos-discount-display.ts`
- `web/modules/pos/components/pos-discount-display.spec.ts`
- `web/modules/pos/components/PosScreen.tsx`
- `docs/evidencia-qa-pos-descuento-balanza.md`

## Risk

Bajo. El cambio no altera payloads, precios, impuestos ni persistencia. Solo cambia texto renderizado.
