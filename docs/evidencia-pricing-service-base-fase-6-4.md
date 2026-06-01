# Evidencia PricingService base - Fase 6.4

## Resultado

FASE 6.4 COMPLETADA.

## Objetivo

Implementar un `PricingService` base para centralizar calculo de precio, impuesto y total de linea para futura integracion POS/Orders, sin promociones y sin persistir datos.

## Archivos modificados

- `api/src/modules/app.module.ts`
- `api/src/modules/pricing/pricing.module.ts`
- `api/src/modules/pricing/pricing.controller.ts`
- `api/src/modules/pricing/pricing.repository.ts`
- `api/src/modules/pricing/pricing.service.ts`
- `api/src/modules/pricing/pricing.types.ts`
- `api/src/modules/pricing/pricing.controller.spec.ts`
- `api/src/modules/pricing/pricing.service.spec.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`

## Reglas implementadas

- `PricingService.calculateLinePrice(input)` lee el producto por `tenantId + productId`.
- Rechaza producto inexistente o de otro tenant con `product not found`.
- Rechaza producto inactivo con `product is inactive`.
- Rechaza `quantity <= 0`.
- Valida `channel` en `POS | ORDER`.
- Usa `products.price` como `baseUnitPrice`.
- No aplica promociones:
  - `finalUnitPrice = baseUnitPrice`.
  - `discountAmount = 0`.
  - `discountPercent = 0`.
  - `appliedPromotionId = null`.
  - `appliedPromotionName = null`.
- No modifica `products`.
- No modifica `sale_items`.
- No modifica `order_items`.
- No persiste nada; solo hace lectura.

## Calculo impuesto/precio

Regla aplicada para esta fase:

- `products.price` se trata como precio visible con impuesto incluido.
- Esta decision respeta la logica actual observada en ventas y funciones SQL:
  - `price_without_tax = price / (1 + tax_rate)`.
  - `tax_amount = line_total - tax_base`.
- `taxes.rate` usa valores tipo `0.19` para 19%.
- `taxes.is_included` se conserva como snapshot conceptual, pero no cambia la formula en esta fase.
- Redondeo a 2 decimales.

Ejemplo con IVA 19%:

```json
{
  "quantity": 2,
  "baseUnitPrice": 119,
  "finalUnitPrice": 119,
  "taxRate": 0.19,
  "taxBase": 200,
  "taxAmount": 38,
  "lineSubtotal": 200,
  "lineTotal": 238
}
```

## Endpoint creado

`POST /api/pricing/preview-line`

Payload:

```json
{
  "branchId": "uuid",
  "productId": "uuid",
  "quantity": 2,
  "channel": "POS",
  "customerId": "uuid opcional",
  "date": "2026-06-01 opcional"
}
```

Notas:

- `tenantId` se toma del token autenticado.
- Si el payload trae `tenantId`, el controller lo ignora para evitar spoofing.
- Permiso usado: `INVENTORY_PRODUCTS` nivel `READ`.
- Este endpoint solo previsualiza. No crea ventas ni pedidos.

## Pruebas ejecutadas

```bash
cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts
```

Resultado:

- 10 tests pass.
- 0 fail.

Casos cubiertos:

- producto sin impuesto.
- producto con impuesto.
- cantidad decimal.
- `quantity = 0` falla.
- producto inactivo falla.
- producto de otro tenant falla.
- no aplica promociones.
- descuento siempre `0`.
- redondeo a 2 decimales.
- no persiste datos.
- endpoint preview usa tenant autenticado.

```bash
cd api && npm.cmd run build
```

Resultado:

- Build pass.

## Confirmaciones de alcance

- No se implementaron promociones.
- No se modifico POS.
- No se modifico Orders.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico `inventory_create_sale_v2`.
- No se modificaron ventas existentes.
- No se modificaron pedidos existentes.
- No se tocaron migraciones ni SQL.
- No se toco frontend.
- No se toco `backend-reporteria/`.
- No se toco PRD real.

## Riesgos vivos

- `taxes.is_included` aun no gobierna una bifurcacion fiscal real. La regla vigente mantiene precio visible con impuesto incluido para no romper ventas actuales.
- POS y Orders todavia no consumen `PricingService`; esto queda para fase posterior.
- No hay promociones todavia; los campos de promocion quedan en `0/null`.

## Proximos pasos

- Integrar `PricingService` en POS con flag o fase controlada.
- Integrar `PricingService` en Orders sin recalcular historicos.
- Definir regla final de `taxes.is_included` antes de facturacion electronica completa.
- Diseñar promociones sobre este contrato sin cambiar ventas historicas.
