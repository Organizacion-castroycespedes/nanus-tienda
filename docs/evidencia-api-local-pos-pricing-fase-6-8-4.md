# Evidencia Fase 6.8.4 - QA API local POS pricing

## Ambiente

- DB usada: `manus_tienda_prd` local/copia QA.
- Servidor DB: `::1/128:5432`.
- Usuario DB observado: `postgres`.
- API local: `http://127.0.0.1:4024/api`.
- Token: JWT local generado en memoria; token completo no fue guardado.
- V051 se aplico solo en DB local/QA tras confirmar que faltaba.

## Precondiciones

- `sale_items` tiene columnas snapshot de V048: OK.
- `chk_sale_items_subtotal_matches` no existe por V050: OK.
- `inventory_create_sale_v2` contiene `POS_PRICING_SERVICE` por V051: OK.
- API local en 4024: OK durante prueba.

## Escenario A - POS con promocion + IVA

- Venta API creada: HTTP `201`.
- `sale_id`: `9e62de80-8fca-4d96-8553-d3ab60339895`.
- Se envio `price` basura desde payload API.
- Resultado DB:
  - `sale_total = 214.20`.
  - `sale_status = CONFIRMED`.
  - `payment_status = PAID`.
  - `sale_items.price = 107.10`.
  - `sale_items.subtotal = 214.20`.
  - `sale_items.price_without_tax = 90.00`.
  - `sale_items.tax_total = 34.20`.
  - `sale_items.base_unit_price = 119.00`.
  - `sale_items.final_unit_price = 107.10`.
  - `sale_items.discount_total = 23.80`.
  - `sale_items.applied_promotion_id = 91000000-0000-0000-0000-000000000701`.
  - `sale_items.applied_promotion_name = Promo POS 684 normal 10%`.
  - `sale_items.tax_base = 180.00`.
  - `sale_items.tax_amount = 34.20`.
  - `sale_items.line_total = 214.20`.
  - `sale_items.pricing_source = POS_PRICING_SERVICE`.
  - `pricing_snapshot` persistido: OK.
  - `sale_item_taxes.tax_rate = 0.1900`.
  - `sale_item_taxes.tax_amount = 34.20`.

## Escenario B - Mutacion posterior

Despues de crear la venta se mutaron datos actuales:

- `products.price = 999.00`.
- `taxes.rate = 0.0500`.
- `promotions.is_active = false`.

La venta ya creada no cambio:

- `sale_total = 214.20`.
- `sale_items.price = 107.10`.
- `sale_items.discount_total = 23.80`.
- `sale_items.tax_amount = 34.20`.
- `sale_item_taxes.tax_rate = 0.1900`.
- `pricing_source = POS_PRICING_SERVICE`.

## Escenario C - CASH mismatch

- Intento API con pago distinto al total backend: HTTP `400`.
- Conteos antes:
  - `sales = 1`.
  - `sale_items = 1`.
  - `stock_sale_out = 1`.
  - `stock_movement_lots_sale_out = 0`.
- Conteos despues:
  - `sales = 1`.
  - `sale_items = 1`.
  - `stock_sale_out = 1`.
  - `stock_movement_lots_sale_out = 0`.
- No se crearon ventas ni movimientos huerfanos por el mismatch.

## Escenario D - FEFO/lotes

- Venta API creada: HTTP `201`.
- `sale_id`: `104b64a6-7ce8-48f0-9088-d46333f6a832`.
- Resultado DB:
  - `sale_total = 321.30`.
  - `sale_status = CONFIRMED`.
  - `payment_status = PAID`.
  - `sale_items.price = 107.10`.
  - `sale_items.subtotal = 321.30`.
  - `sale_items.discount_total = 35.70`.
  - `sale_items.tax_amount = 51.30`.
  - `sale_items.line_total = 321.30`.
  - `sale_items.pricing_source = POS_PRICING_SERVICE`.
  - `pricing_snapshot` persistido: OK.
  - `sale_item_taxes.tax_rate = 0.1900`.
  - `sale_item_taxes.tax_amount = 51.30`.
- FEFO consumio:
  - `S684-FEFO-EARLY`, vencimiento `2026-07-02`, cantidad `2.00`.
  - `S317-API-ONE-A`, vencimiento `2026-08-31`, cantidad `1.00`.
- El lote mas cercano fue consumido primero.

## Escenario E - Legacy

- Validacion directa de `inventory_create_sale_v2` sin `pricing_source`.
- Resultado DB:
  - `sale_total = 44.00`.
  - `sale_status = DRAFT`.
  - `item_price = 44.00`.
  - `item_subtotal = 44.00`.
  - `pricing_source = NULL`.
  - `line_total = NULL`.
  - `tax_rate = 0.0500`.
  - `tax_amount = 2.10`.
- Legacy sigue funcionando y calcula impuesto desde `products/taxes` actuales.

## Cleanup

- Cleanup final ejecutado con orden custom para incluir promociones y taxes.
- `fixtureRowsRemaining = 0`.
- API local apagada.
- Puerto `4024` sin listener al final.

## Observaciones

- Primer intento API devolvio HTTP `401` porque `JwtAuthGuard` lee `JWT_SECRET` antes de `dotenv.config()` en `main.ts`; el guard uso fallback `changeme`. Se repitio QA con JWT local firmado con ese fallback. No se modifico codigo.
- El cleanup heredado de sale v2 no borra promociones/taxes; para esta fase se ejecuto cleanup custom local.

## Restricciones cumplidas

- No se toco logica funcional.
- No se modifico SQL.
- No se modifico TypeScript.
- No se toco frontend.
- No se toco Orders.
- No se toco facturacion electronica.
- No se toco DIAN, GetAcquirer ni suppliers.
- No se toco PRD real.
- No se ejecuto remoto.
- No se hizo commit.
