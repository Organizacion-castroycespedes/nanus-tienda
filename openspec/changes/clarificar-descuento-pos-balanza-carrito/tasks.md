## 1. Analysis

- [x] Revisar render del carrito POS.
- [x] Identificar origen de precio base, precio final, cantidad, descuento y producto de balanza.
- [x] Confirmar que el calculo actual de linea e impuestos no debe cambiar.

## 2. Implementation

- [x] Extraer helper pequeno para construir texto/partes de descuento.
- [x] Integrar helper en `PosScreen.tsx`.
- [x] Mantener texto compacto para cantidad 1.
- [x] Mostrar descuento unitario y ahorro total para balanza, cantidad decimal o cantidad distinta de 1.
- [x] Evitar valores invalidos en UI.
- [x] Mantener total de linea, impuestos, stock, promociones y venta POS sin cambios funcionales.

## 3. Tests

- [x] Agregar tests del helper de descuento.
- [x] Validar producto sin promocion.
- [x] Validar promocion con cantidad 1.
- [x] Validar promocion con cantidad 2.
- [x] Validar promocion con balanza y cantidad 1.25.
- [x] Validar promocion con balanza y cantidad decimal menor a 1.

## 4. Validation

- [x] `openspec.cmd validate clarificar-descuento-pos-balanza-carrito --type change --strict`
- [x] Tests especificos POS/cart/pricing.
- [x] `cd web && npm.cmd run build`
- [x] `git diff --check`
- [x] QA manual documentado como NO EJECUTADO por falta de navegador/herramienta disponible y credenciales de sesion local.
