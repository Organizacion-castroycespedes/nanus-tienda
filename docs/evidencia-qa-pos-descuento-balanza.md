# Evidencia QA POS descuento balanza

## Estado

PASS tecnico. QA manual en navegador: NO EJECUTADO.

## Alcance

Se ajusto solo la presentacion del descuento en el carrito POS para productos con promocion y cantidad distinta de 1, cantidad decimal o lectura por balanza.

No se cambiaron calculos de total de linea, impuestos, stock, promociones, venta POS, caja, pedidos, backend ni contratos API.

## Caso Cafe observado

- Producto: Cafe
- Codigo: 678624254445
- Cantidad/peso: 1.25
- Precio base unitario: $4.000
- Precio promocional unitario: $3.600
- Promocion: MOCK10 PORCIENTO DIA DEL PADRE
- Stock disponible: 46.75
- Total linea esperado: $4.500
- Impuestos del item esperados: $718,49
- Descuento unitario esperado: $400
- Ahorro total esperado: $500

Texto esperado en carrito:

```text
Descuento $ 400 c/u  Ahorro total $ 500 (10%)
```

## Validaciones tecnicas

- `openspec.cmd validate clarificar-descuento-pos-balanza-carrito --type change --strict`: PASS.
- `api\\node_modules\\tsx\\dist\\cli.mjs --test web\\modules\\pos\\components\\pos-discount-display.spec.ts`: PASS, 6 tests.
- `cd web && npm.cmd run build`: PASS con warnings existentes.

## Escenarios cubiertos por test unitario

- Producto sin promocion.
- Producto con promocion y cantidad 1.
- Producto con promocion y cantidad 2.
- Producto con promocion + balanza + cantidad 1.25.
- Producto con promocion + balanza + cantidad decimal menor a 1.
- Datos invalidos sin `NaN`, `undefined`, `null`, negativos ni porcentaje inventado.

## QA manual

NO EJECUTADO.

Causa: en esta sesion no hubo herramienta de navegador local disponible ni credenciales/sesion local para operar `http://localhost:3000/00000000-0000-0000-0000-000000000001/pos`.

Checklist pendiente para ejecutar en navegador real:

- [ ] producto sin promocion.
- [ ] producto con promocion y cantidad 1.
- [ ] producto con promocion y cantidad 2.
- [ ] producto con promocion + leer balanza + cantidad 1.25.
- [ ] producto con promocion + leer balanza + cantidad decimal menor a 1.

## Confirmaciones

- No PRD.
- No SQL.
- No backend.
- No permisos ni guards.
- No persistencia.
- No deploy.
- No commit.
