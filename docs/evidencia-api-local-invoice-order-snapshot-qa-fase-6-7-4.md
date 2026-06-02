# Evidencia API local invoice order snapshot QA - Fase 6.7.4.QA

## Alcance

Validacion complementaria local de `inventory_invoice_order` sin tocar logica funcional ni SQL permanente.

Escenarios validados:

- Fallback legacy sin snapshot suficiente en `order_items`.
- Linea con producto sin `tax_id`.
- Redondeo parcial en facturacion por cantidades parciales.

## Ambiente

- API local usada: `http://localhost:4024/api`.
- DB local/copia QA: `manus_tienda_prd`.
- Host DB confirmado: `::1/128`.
- Puerto DB confirmado: `5432`.
- No se documentaron credenciales.
- No se documento token completo.
- No se ejecuto remoto.
- No se toco PRD real.

Precheck DB:

```text
database: manus_tienda_prd
server_addr: ::1/128
server_port: 5432
is_local_addr: true
```

Precheck V048/V049 por efectos aplicados:

```text
sale_items_snapshot_columns: true
inventory_invoice_order contains ORDER_ITEM_SNAPSHOT: true
inventory_invoice_order contains LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT: true
```

Nota: `migrations_history` no registra V048/V049, igual que la evidencia anterior, porque fueron aplicadas por ejecucion directa en DB local/copia QA. La aplicacion se confirma por columnas y cuerpo de funcion.

## API local

El puerto `4024` ya estaba ocupado por un proceso local de esta API:

```text
PID: 32464
CommandLine: node ... D:/Profe/manus-tienda/api ... src/main.ts
```

Se uso ese proceso local para la validacion. Al final se detuvo el PID `32464`.

Verificacion final de puerto:

```text
No listener en 4024.
Solo quedo TIME_WAIT local temporal.
```

## Fixture local

Fixture controlado con UUID prefijo `67440000-*`.

Se crearon temporalmente:

- tenant
- sucursal
- usuario `SUPER_ADMIN`
- auth session
- POS session
- terminal
- customer
- unit
- tax IVA 19%
- 3 productos
- 3 pedidos
- 3 `order_items`

Resultado al insertar fixture:

```text
fixtureRowsAfterInsert: 20
```

## Escenario 1: fallback legacy sin snapshot

Pedido con `order_items` sin snapshot suficiente:

- `final_unit_price = NULL`
- `line_total = NULL`
- `pricing_calculated_at = NULL`

Resultado API:

```text
saleId: 1c9a0684-2442-4478-b2d4-dda9c6b4a2ec
sale.total: 119.00
sale.balance: 119.00
sale.status: CONFIRMED
sale.type: CREDIT
```

Resultado `sale_items`:

```text
quantity: 1.00
price: 119.00
price_without_tax: 100.00
tax_total: 19.00
subtotal: 119.00
base_unit_price: 119.00
final_unit_price: 119.00
discount_amount: 0.00
discount_percent: 0.0000
discount_total: 0.00
applied_promotion_id: null
applied_promotion_name: null
tax_base: 100.00
tax_amount: 19.00
line_total: 119.00
pricing_source: LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT
sale_item_taxes_count: 1
```

Resultado: OK. Invoice funciona con fallback legacy. `pricing_source` correcto. Descuento/promocion quedan en cero/null.

## Escenario 2: linea sin impuesto

Producto con `tax_id = NULL` y snapshot suficiente en `order_items`.

Resultado API:

```text
saleId: 93275485-ec24-4dd0-887e-9dd14c5a4e48
sale.total: 42.00
sale.balance: 42.00
sale.status: CONFIRMED
sale.type: CREDIT
```

Resultado `sale_items`:

```text
quantity: 1.00
price: 42.00
price_without_tax: 42.00
tax_total: 0.00
subtotal: 42.00
base_unit_price: 42.00
final_unit_price: 42.00
discount_total: 0.00
tax_base: 42.00
tax_amount: 0.00
line_total: 42.00
pricing_source: ORDER_ITEM_SNAPSHOT
sale_item_taxes_count: 0
```

Resultado: OK. Invoice funciona. No crea `sale_item_taxes` cuando `order_items.tax_id IS NULL`. `pricing_source` correcto.

## Escenario 3: redondeo parcial

Pedido con:

```text
ordered_quantity: 3.00
line_total: 100.00
tax_amount: 15.97
```

Se facturo en 3 pasos de cantidad `1.00`. Para simular entregas progresivas del fixture, se aumento `delivered_quantity` controladamente entre facturas. No se modifico logica funcional.

Resultado por cada factura parcial:

```text
quantity: 1.00
price: 33.33
price_without_tax: 28.01
tax_total: 5.32
subtotal: 33.33
tax_base: 28.01
tax_amount: 5.32
line_total: 33.33
pricing_source: ORDER_ITEM_SNAPSHOT
sale_item_taxes_count: 1
```

Totales acumulados despues de 3 facturas:

```text
sales_total_sum: 99.99
sale_items_tax_amount_sum: 15.96
sale_item_taxes_tax_amount_sum: 15.96
order_line_total: 100.00
order_tax_amount: 15.97
line_total_diff: -0.01
tax_amount_diff: -0.01
billed_quantity: 3.00
```

Resultado: invoice funciona en facturacion parcial. Riesgo documentado: con 3 facturas parciales, el redondeo por factura deja diferencia acumulada de `-0.01` en total de linea y `-0.01` en impuesto. No se corrigio en esta fase.

## Cleanup

Cleanup ejecutado sobre fixture `67440000-*`.

Resultado:

```text
fixtureRowsRemaining: 0
```

API local detenida despues de la prueba.

## Validaciones autorizadas

Ejecutadas despues de crear esta evidencia:

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`

## Restricciones cumplidas

- No se modifico logica funcional.
- No se modifico SQL permanente.
- No se modificaron migraciones.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se modifico POS.
- No se modifico frontend.
- No se modifico facturacion electronica.
- No se modifico DIAN.
- No se modifico GetAcquirer.
- No se modifico suppliers.
- No se ejecuto remoto.
- No se toco PRD real.
- No se guardaron credenciales.
- No se hizo commit.

## Riesgos pendientes

- Redondeo parcial puede acumular diferencias de centavos cuando varias facturas parciales prorratean la misma linea. Caso observado: `-0.01` en total y `-0.01` en impuesto para 3 parciales.
- Falta definir regla oficial de absorcion de centavos, por ejemplo en ultima factura parcial.
- `migrations_history` no registra V048/V049 en esta DB local/copia QA, aunque los efectos estan aplicados.
- Observacion local: el JWT efectivo del API local no coincidio con el secreto leido desde `.env` por el harness. No se documento token ni credenciales. Revisar carga temprana de `JWT_SECRET` en otro cambio si aplica.
