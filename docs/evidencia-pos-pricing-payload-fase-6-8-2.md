# Evidencia POS pricing payload - Fase 6.8.2

## Objetivo

Preparar `SaleService.createSale` para calcular pricing POS por linea con `PricingService` antes de llamar a `inventory_create_sale_v2`.

## Alcance implementado

- `SaleService.createSale` inyecta y usa `PricingService`.
- Cada item POS llama `calculateLinePrice` con `tenantId`, `branchId`, `customerId`, `productId`, `quantity`, `channel = "POS"` y una fecha unica de venta.
- El backend ignora `items[].price` del frontend para el calculo final.
- Se calcula `backendTotal` como suma de `lineTotal`.
- Se rechaza venta `CASH` cuando la suma de pagos no coincide con `backendTotal`.
- `SaleRepository.createSaleWithFunction` serializa payload enriquecido a snake_case.
- `inventory_create_sale_v2` queda sin cambios; puede ignorar campos nuevos hasta Fase 6.8.3.

## Payload POS enriquecido

Campos enviados por item:

- `product_id`
- `quantity`
- `price`
- `order_item_id`
- `subtotal`
- `price_without_tax`
- `tax_total`
- `base_unit_price`
- `final_unit_price`
- `discount_amount`
- `discount_percent`
- `discount_total`
- `applied_promotion_id`
- `applied_promotion_name`
- `tax_id`
- `tax_rate`
- `tax_base`
- `tax_amount`
- `line_total`
- `pricing_snapshot`
- `pricing_calculated_at`
- `pricing_source = POS_PRICING_SERVICE`

## Pruebas ejecutadas

```text
cd api && npx.cmd tsx --test src/modules/inventory/services/sale.service.spec.ts
Resultado: pass, 10/10

cd api && npx.cmd tsx --test src/modules/inventory/repositories/sale.repository.spec.ts
Resultado: pass, 7/7
```

## Validaciones ejecutadas

```text
cd api && npm.cmd run build
Resultado: pass

openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
Resultado: pass

git diff --check
Resultado: pass
Nota: Git aviso conversion LF -> CRLF en archivos modificados; no hubo errores de whitespace.
```

## Riesgos pendientes para 6.8.3

- `inventory_create_sale_v2` aun lee solo `product_id`, `quantity`, `price` y `order_item_id`.
- Los campos snapshot POS aun no se persisten en `sale_items`.
- `sale_item_taxes` aun se calcula desde SQL legacy, no desde snapshot de `PricingService`.
- Para impuestos no incluidos, puede existir diferencia entre `lineTotal` backend y el total que SQL calcula mientras ignore `line_total`.

## Confirmacion de no alcance

No se modifico SQL, migraciones, `inventory_create_sale_v2`, frontend POS, Orders, facturacion electronica, DIAN, GetAcquirer, suppliers, PRD real, remoto ni commits.
