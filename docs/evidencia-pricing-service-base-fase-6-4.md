# Evidencia PricingService base - Fase 6.4 hardening

## Resultado

FASE 6.4 HARDENING COMPLETADA.

Se fortalecio el calculo base de pricing sin promociones y se mantuvo compatible el flujo actual de `POST /api/pricing/preview-line`, que ya puede aplicar promociones.

## Objetivo

Separar el calculo base de precio, impuesto, subtotal y total de linea para que exista una ruta sin promociones reutilizable, sin eliminar ni romper la logica posterior de promociones.

## Archivos modificados

- `api/src/modules/pricing/pricing.service.ts`
- `api/src/modules/pricing/pricing.service.spec.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-pricing-service-base-fase-6-4.md`

## Reglas implementadas

- `PricingService.calculateLineWithoutPromotions(input)` calcula la linea base sin consultar promociones.
- `PricingService.calculateLinePrice(input)` reutiliza el calculo base y despues aplica la promocion seleccionada si existe.
- `POST /api/pricing/preview-line` mantiene el contrato actual.
- `findApplicablePromotions` se mantiene.
- `selectBestPromotion` se mantiene.
- Promociones CRUD se mantiene sin cambios.
- `products.price` sigue siendo la fuente de precio vigente.
- No se persisten ventas, pedidos, productos ni historial.

## Calculo base

Respuesta base:

- `productId`: producto consultado por `tenantId + productId`.
- `quantity`: cantidad validada y redondeada a 2 decimales.
- `baseUnitPrice`: `products.price`.
- `finalUnitPrice`: igual a `baseUnitPrice`.
- `discountAmount`: `0`.
- `discountPercent`: `0`.
- `appliedPromotionId`: `null`.
- `appliedPromotionName`: `null`.
- `taxId`: impuesto asociado o `null`.
- `taxRate`: `taxes.rate`.
- `taxBase`, `taxAmount`, `lineSubtotal`, `lineTotal`: calculados desde precio final y cantidad.

Reglas de impuesto:

- Si `taxes.is_included = true`, `products.price` se trata como precio visible con impuesto incluido.
- Si `taxes.is_included = false`, `products.price` se trata como precio base sin impuesto y se suma el impuesto al total.
- Si no hay impuesto o `taxRate = 0`, `taxAmount = 0`.

## Compatibilidad con promociones

El preview con promociones sigue funcionando:

- Consulta promociones aplicables.
- Calcula descuento unitario.
- Selecciona promocion por prioridad, descuento, recencia e `id`.
- Recalcula impuestos sobre el `finalUnitPrice`.
- Mantiene `preview-line` sin persistencia.

## Pruebas ejecutadas

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/pricing/*.spec.ts
```

Resultado:

- suites: 4
- tests: 36
- pass: 36
- fail: 0

Casos cubiertos:

- producto sin impuesto.
- producto con impuesto incluido.
- producto con impuesto no incluido.
- cantidad mayor a 1.
- cantidad decimal.
- `quantity <= 0` falla.
- producto inexistente falla.
- producto inactivo falla.
- producto de otro tenant falla como `product not found`.
- calculo base no consulta promociones.
- preview con promociones sigue funcionando.

Build:

```powershell
cd api
npm.cmd run build
```

Resultado: OK.

OpenSpec:

```powershell
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: OK, 1 item passed, 0 failed.

Diff check:

```powershell
git diff --check
```

Resultado: OK. Solo aviso LF/CRLF de Windows, sin errores de whitespace.

## Riesgos vivos

- `products.price` es la fuente vigente despues de `change-price`.
- `price_with_tax` y `price_without_tax` pueden quedar desfasados porque `change-price` actualiza solo `products.price`.
- POS y Orders aun no consumen `PricingService`.
- Persistir descuentos/promociones aplicadas en ventas o pedidos sigue fuera de esta fase.

## Confirmaciones de no alcance

No se modifico:

- facturacion electronica.
- DIAN.
- suppliers fiscales.
- backend-facturacion-electronica.
- POS.
- Orders.
- frontend.
- migraciones.
- promociones CRUD.
- PRD real.
- servidor remoto.
