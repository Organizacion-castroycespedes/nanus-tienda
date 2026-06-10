# Evidencia API local invoice order snapshot - Fase 6.7.4.3

## Alcance

Validacion runtime local de facturacion desde pedido usando `inventory_invoice_order`.

Objetivo validado: cuando `order_items` tiene snapshot suficiente, la venta usa ese snapshot y no recalcula precio, promocion ni impuesto desde `products`, `promotions` ni `taxes` actuales.

## Ambiente

- API local: `http://localhost:4024/api`
- DB local/copia QA: `manus_tienda_prd`
- Host DB confirmado: `::1/128`
- Puerto DB confirmado: `5432`
- Usuario DB confirmado: `postgres`
- No se documento token completo.
- No se documentaron credenciales.
- No se ejecuto remoto.
- No se toco PRD real.

## Precondiciones DB

Consulta local ejecutada antes de aplicar migraciones:

```sql
SELECT COALESCE(inet_server_addr()::text, 'local-socket'), inet_server_port(), current_database();
```

Resultado:

```text
::1/128 | 5432 | manus_tienda_prd
```

La DB local inicialmente no tenia V048/V049 aplicadas:

- `sale_items` no tenia columnas snapshot.
- `inventory_invoice_order` no contenia `ORDER_ITEM_SNAPSHOT`.
- `public.migrations_history` no registraba V048/V049.

Con aprobacion explicita se aplicaron en DB local/copia QA:

- `scripts/database/migrations/V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql`
- `scripts/database/migrations/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`

Verificacion posterior:

```text
sale_items snapshot columns: true
inventory_invoice_order contains ORDER_ITEM_SNAPSHOT: true
inventory_invoice_order contains LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT: true
migrations_history V048/V049: no registrado por ejecucion directa con psql -f
```

## Fixture local

Fixture controlado con UUID prefijo `67430000-*`:

- tenant
- branch
- usuario `SUPER_ADMIN`
- auth/session necesaria
- terminal
- customer
- unit
- tax IVA incluido 19%
- product con precio actual inicial `119.00`
- promotion `FIXED_AMOUNT 19.00`
- stock suficiente

No se tocaron suppliers fiscales.

## Flujo API ejecutado

1. API local levantada en puerto `4024`.
2. Se abrio sesion POS local:

```http
POST /api/pos/session
```

3. Se creo pedido enviando `price`, `subtotal` y `total` basura:

```http
POST /api/orders
```

Resultado:

```text
orderId: 85537b12-25f4-4bc9-90a9-ea096d1ccbe1
createdTotal: 200
```

4. Se confirmo pedido:

```http
POST /api/orders/:id/confirm
```

Resultado:

```text
confirmedStatus: CONFIRMED
```

5. Se entrego parcialmente cantidad `1` de un pedido de cantidad `2`:

```http
POST /api/orders/:id/deliver
```

Resultado:

```text
deliveredStatus: PARTIAL
```

## Snapshot de order_items antes de mutar datos actuales

```text
order_item_id: cd449c5a-e51d-4835-8d16-762d9991ba94
ordered_quantity: 2.00
delivered_quantity: 1.00
billed_quantity: 0.00
price: 100.00
base_unit_price: 119.00
final_unit_price: 100.00
discount_amount: 19.00
discount_total: 38.00
applied_promotion_id: 67430000-0000-0000-0000-000000000013
applied_promotion_name: Promo QA 6743 -19
tax_rate: 0.1900
tax_base: 168.06
tax_amount: 31.94
line_total: 200.00
pricing_calculated_at present: true
```

## Mutacion posterior a pedido/entrega

Despues de crear y entregar el pedido, se cambiaron datos actuales:

```text
products.price: 250.00
products.price_with_tax: 250.00
products.price_without_tax: 238.10
taxes.rate: 0.0500
promotions.is_active: false
```

Esto prueba que la facturacion no podia depender de los valores vigentes sin romper el snapshot.

## Facturacion API

Se facturo el pedido:

```http
POST /api/orders/:id/invoice
```

Payload:

```json
{ "type": "CREDIT", "payments": [] }
```

Resultado:

```text
saleId: ee64f3de-b7a1-4767-868c-b12656c95ac1
saleTotal: 100
saleBalance: 100
saleStatus: CONFIRMED
saleType: CREDIT
```

## Verificacion DB de sale_items y sale_item_taxes

Prorrateo esperado para cantidad facturada `1` sobre cantidad pedida `2`:

- `line_total`: `200.00 * 1 / 2 = 100.00`
- `discount_total`: `38.00 * 1 / 2 = 19.00`
- `tax_amount`: `31.94 * 1 / 2 = 15.97`

Resultado verificado:

```text
sale_item_id: 6ac70d71-b88d-470f-b06c-2d3985fb6336
quantity: 1.00
order_items.final_unit_price: 100.00
sale_items.price: 100.00
expected_subtotal: 100.00
sale_items.subtotal: 100.00
expected_discount: 19.00
sale_items.discount_total: 19.00
promo_id_ok: true
promo_name_ok: true
pricing_source: ORDER_ITEM_SNAPSHOT
order_items.tax_rate: 0.1900
sale_item_taxes.tax_rate: 0.1900
expected_tax_amount: 15.97
sale_item_taxes.tax_amount: 15.97
current taxes.rate after mutation: 0.0500
current products.price after mutation: 250.00
current promotion active after mutation: false
price_ok: true
subtotal_ok: true
discount_ok: true
source_ok: true
tax_rate_ok: true
tax_amount_ok: true
```

Conclusion: `inventory_invoice_order` uso snapshot de `order_items`. No uso `products.price = 250.00`, no uso `taxes.rate = 0.0500`, y no recalculo promocion despues de desactivar la promocion actual.

## Cleanup

Cleanup ejecutado sobre fixture `67430000-*`.

Resultado:

```text
fixtureRowsRemaining: 0
```

## Validaciones autorizadas

Pendientes de ejecutar despues de crear esta evidencia:

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`

## Restricciones cumplidas

- No se modifico logica funcional en archivos.
- No se modificaron archivos SQL.
- Se aplicaron V048/V049 solo en DB local/copia QA con aprobacion explicita.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico POS.
- No se modifico frontend.
- No se modifico facturacion electronica.
- No se modifico DIAN.
- No se modifico GetAcquirer.
- No se modifico suppliers fiscales.
- No se ejecuto remoto.
- No se toco PRD real.
- No se hizo commit.

## Riesgos pendientes

- Fallback legacy no probado en esta corrida.
- Linea sin impuesto no probada en esta corrida.
- Redondeo parcial pendiente: no se implemento logica de ultima factura que absorbe centavos.
