# Evidencia API local Orders + PricingService - Fase 6.7.3

## Decision final

FASE 6.7.3 APROBADA.

`POST /api/orders` y `PUT /api/orders/:id` con `items` recalculan precios con `PricingService`, ignoran `price`, `subtotal` y `total` enviados desde el cliente, y persisten snapshot de pricing en `order_items`.

## Ambiente usado

- API local: `http://localhost:4024/api`
- DB local/copia QA: `manus_tienda_prd`
- PostgreSQL: `::1/128:5432`
- Confirmacion: host local, no PRD real.
- Token local usado en runtime, no documentado.

## Precondicion

La migracion `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql` ya estaba aplicada en la BD local.

Verificacion previa:

- `present_count=14`
- `missing_count=0`

## Fixture local

Prefijo UUID:

`96730000-0000-0000-0000-*`

Datos creados temporalmente:

- tenant local QA
- sucursal local QA
- usuario local `SUPER_ADMIN`
- cliente
- unidad
- IVA incluido `0.19`
- producto sin promocion con `products.price=119`
- producto con promocion con `products.price=119`
- promocion activa `FIXED_AMOUNT=19` para el producto promocionado y la sucursal fixture

Filas fixture antes de cleanup: `14`.

## Payload basura enviado

En create se envio:

```json
{
  "total": 999999,
  "items": [
    {
      "price": 1,
      "subtotal": 2
    }
  ]
}
```

En update DRAFT se envio:

```json
{
  "total": 777777,
  "items": [
    {
      "price": 1,
      "subtotal": 3
    }
  ]
}
```

## Pedido sin promocion

Pedido creado:

`61f0c596-0be9-4401-822b-aee50934aaaf`

Resultado persistido:

- `orders.total`: `238`
- `order_items.price`: `119`
- `order_items.subtotal`: `238`
- `base_unit_price`: `119`
- `final_unit_price`: `119`
- `discount_amount`: `0`
- `discount_percent`: `0`
- `discount_total`: `0`
- `applied_promotion_id`: `NULL`
- `applied_promotion_name`: `NULL`
- `tax_rate`: `0.19`
- `tax_base`: `200`
- `tax_amount`: `38`
- `line_total`: `238`
- `pricing_snapshot.channel`: `ORDER`
- `pricing_snapshot.result.finalUnitPrice`: `119`
- `pricing_snapshot.result.lineTotal`: `238`
- `pricing_calculated_at`: presente

## Pedido con promocion

Pedido creado:

`1177cba3-f851-4edb-933c-26d26f95ccc8`

Resultado persistido:

- `orders.total`: `200`
- `order_items.price`: `100`
- `order_items.subtotal`: `200`
- `base_unit_price`: `119`
- `final_unit_price`: `100`
- `discount_amount`: `19`
- `discount_percent`: `15.97`
- `discount_total`: `38`
- `applied_promotion_id`: `96730000-0000-0000-0000-000000000201`
- `applied_promotion_name`: `QA_ORDERS_673_FIXED_19`
- `tax_rate`: `0.19`
- `tax_base`: `168.06`
- `tax_amount`: `31.94`
- `line_total`: `200`
- `pricing_snapshot.channel`: `ORDER`
- `pricing_snapshot.result.finalUnitPrice`: `100`
- `pricing_snapshot.result.lineTotal`: `200`
- `pricing_snapshot.result.appliedPromotionId`: `96730000-0000-0000-0000-000000000201`
- `pricing_snapshot.result.appliedPromotionName`: `QA_ORDERS_673_FIXED_19`
- `pricing_snapshot.result.taxBase`: `168.06`
- `pricing_snapshot.result.taxAmount`: `31.94`
- `pricing_calculated_at`: presente

## Update DRAFT con items

Se actualizo el pedido promocionado en estado `DRAFT` con cantidad `3` y payload basura.

Resultado persistido:

- `orders.total`: `300`
- `ordered_quantity`: `3`
- `order_items.price`: `100`
- `order_items.subtotal`: `300`
- `base_unit_price`: `119`
- `final_unit_price`: `100`
- `discount_amount`: `19`
- `discount_total`: `57`
- `applied_promotion_id`: `96730000-0000-0000-0000-000000000201`
- `applied_promotion_name`: `QA_ORDERS_673_FIXED_19`
- `tax_base`: `252.09`
- `tax_amount`: `47.91`
- `line_total`: `300`
- `pricing_snapshot.result.finalUnitPrice`: `100`
- `pricing_snapshot.result.lineTotal`: `300`
- `pricing_snapshot.result.appliedPromotionId`: `96730000-0000-0000-0000-000000000201`

## Evidencia de ignorar payload cliente

El cliente envio `total=999999`, `price=1`, `subtotal=2` en create.

La base guardo:

- Sin promocion: `orders.total=238`, `price=119`, `subtotal=238`.
- Con promocion: `orders.total=200`, `price=100`, `subtotal=200`.

El cliente envio `total=777777`, `price=1`, `subtotal=3` en update DRAFT.

La base guardo:

- Update DRAFT: `orders.total=300`, `price=100`, `subtotal=300`.

## Cleanup

Cleanup ejecutado despues de detener la API local iniciada por la validacion.

Resultado:

`fixtureRowsRemaining=0`

## Comandos ejecutados

Sin secretos:

```powershell
SELECT COALESCE(inet_server_addr()::text, 'local-socket'), inet_server_port(), current_database();
npm.cmd run start:dev
POST http://localhost:4024/api/auth/login/force
POST http://localhost:4024/api/orders
PUT http://localhost:4024/api/orders/:id
```

## No tocado

- Logica funcional
- `OrderService`
- `SaleService`
- `invoiceOrder`
- POS
- Frontend
- Facturacion electronica
- DIAN
- GetAcquirer
- suppliers fiscales
- PRD real
- Remoto
- Commits

## Riesgos vivos

- `PUT /api/orders/:id` sin `items` mantiene el comportamiento documentado en Fase 6.7.2: puede actualizar `total` sin recalcular snapshots. Esta validacion cubre update DRAFT con `items`, que es el flujo que debe recalcular con `PricingService`.
