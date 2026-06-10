# Diseno tecnico POS usa PricingService - Fase 6.8.1

## 1. Resumen ejecutivo

La venta POS directa hoy entra por `POST /api/sales` y termina en la funcion SQL `inventory_create_sale_v2`. Ese flujo ya resuelve venta, items, impuestos, stock, FEFO/lotes y pagos dentro de una transaccion, pero usa `items[].price` enviado por el frontend como precio final.

La Fase 6.8 debe mover el calculo de precio, promocion, descuento e impuesto al backend usando `PricingService`, y debe conservar un snapshot por `sale_item`. Esta Fase 6.8.1 solo documenta el diseno. No modifica logica funcional ni SQL.

Decision central: `SaleService.createSale` debe calcular cada linea POS con `PricingService`, ignorar el precio enviado por el cliente para el calculo final, y enviar a `inventory_create_sale_v2` un JSON enriquecido. La funcion SQL debe seguir siendo la responsable de stock, FEFO/lotes y persistencia transaccional.

## 2. Alcance

- Documentar el flujo POS actual.
- Documentar el problema de confianza en `items[].price`.
- Documentar el contrato interno `SaleService` -> `PricingService`.
- Documentar el contrato JSON enriquecido hacia `inventory_create_sale_v2`.
- Documentar la estrategia para `sale_item_taxes`, pagos/caja, FEFO/lotes y `SaleItemEntity`.
- Definir fases futuras 6.8.2, 6.8.3 y 6.8.4.
- Registrar riesgos, criterios de aceptacion y validaciones propuestas.

## 3. Fuera de alcance

- Cambiar `SaleService`.
- Cambiar `SaleRepository`.
- Cambiar `SaleItemEntity`.
- Cambiar `inventory_create_sale_v2`.
- Cambiar SQL funcional o migraciones.
- Cambiar POS frontend o POS UI.
- Cambiar Orders.
- Cambiar facturacion electronica.
- Cambiar DIAN, GetAcquirer o suppliers.
- Ejecutar remoto, tocar PRD real o hacer commit.

## 4. Flujo POS actual

Flujo principal:

```text
POST /api/sales
  -> SaleController.create
  -> SaleService.createSale
  -> SaleRepository.createSaleWithFunction
  -> inventory_create_sale_v2
```

Archivos relevantes:

- `api/src/modules/inventory/controllers/sale.controller.ts`
- `api/src/modules/inventory/services/sale.service.ts`
- `api/src/modules/inventory/repositories/sale.repository.ts`
- `scripts/database/migrations/20260602_inventory_create_sale_v2.sql`
- `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`

Responsabilidades actuales:

- `SaleController` recibe el payload HTTP y lo pasa a `SaleService.createSale`.
- `SaleService.createSale` valida contexto operativo, sesion POS, customer/order cuando aplica, pagos y delega la creacion transaccional.
- `SaleRepository.createSaleWithFunction` arma JSON de items y pagos para SQL.
- `inventory_create_sale_v2` crea `sales`, `sale_items`, `sale_item_taxes`, `stock_movements`, `stock_movement_lots` y pagos/relaciones de caja.

## 5. Problema actual

El backend hoy confia en `items[].price` enviado por frontend para el calculo final de POS directo.

`inventory_create_sale_v2` recibe cada item en JSON y usa ese precio para calcular item, impuesto y total. Esto permite que una venta POS directa quede con montos distintos a los que deberia decidir el backend segun precio vigente, promocion activa, descuentos e impuestos.

Problemas derivados:

- El precio final puede ser manipulado por cliente.
- Una promocion activa puede no aplicarse.
- Un impuesto puede quedar calculado con base obsoleta.
- `sales.total` puede depender de datos enviados por el frontend.
- Caja/pagos pueden cuadrar contra un total incorrecto.

## 6. Calculo actual

El calculo actual ocurre dentro de `inventory_create_sale_v2` usando `item.price` del JSON.

| Campo | Calculo actual |
| --- | --- |
| `sales.total` | Suma de `ROUND(item.price * item.quantity, 2)` por linea. |
| `sale_items.price` | `item.price` enviado por frontend, redondeado. |
| `sale_items.price_without_tax` | Si hay impuesto, `ROUND(price / (1 + tax_rate), 2)`; si no hay, `price`. |
| `sale_items.tax_total` | `ROUND((price - price_without_tax) * quantity, 2)`. |
| `sale_items.subtotal` | `ROUND(price * quantity, 2)`. |
| `sale_item_taxes` | Usa `tax_id`, `tax_name`, `tax_rate` actuales del producto/impuesto y `tax_amount` calculado en SQL. |

Observacion importante: el calculo legacy trata el precio como precio final con impuesto incluido cuando hay `tax_rate`. Esto vuelve riesgoso el caso `taxes.is_included = false` si en fases futuras el pricing calcula base + impuesto.

## 7. Inventario y FEFO

`inventory_create_sale_v2` tambien es el punto transaccional de inventario.

Elementos actuales:

- Stock agregado: se valida desde `stock_movements` por `tenant_id`, `branch_id` y `product_id`.
- `products.requires_lot`: define si la venta debe consumir lote.
- `inventory_lot_balances`: guarda saldos por lote/sucursal/producto y permite bloqueo transaccional.
- `stock_movement_lots`: deja trazabilidad entre el movimiento de stock y los lotes consumidos.

Para productos loteados, FEFO debe seguir dentro de SQL porque:

- Necesita locks y consistencia transaccional sobre `inventory_lot_balances`.
- Debe ordenar y consumir lotes dentro de la misma transaccion que crea `stock_movements`.
- Debe evitar doble consumo en ventas concurrentes.
- Debe mantener la trazabilidad de `stock_movement_lots`.
- El frontend no debe decidir el lote operativo final.

La integracion con `PricingService` no debe mover FEFO fuera de `inventory_create_sale_v2`.

## 8. Snapshot disponible en sale_items por V048

La migracion V048 ya agrego columnas snapshot nullable a `sale_items`:

- `base_unit_price`
- `final_unit_price`
- `discount_amount`
- `discount_percent`
- `discount_total`
- `applied_promotion_id`
- `applied_promotion_name`
- `tax_base`
- `tax_amount`
- `line_total`
- `pricing_snapshot`
- `pricing_calculated_at`
- `pricing_source`

No hace falta nueva migracion de columnas para Fase 6.8.1. En fases futuras puede hacer falta migracion SQL funcional para actualizar `inventory_create_sale_v2` y persistir esos campos en ventas POS directas.

## 9. Diseno propuesto

El diseno propuesto para fases futuras es:

1. `SaleService.createSale` recibe la venta POS.
2. `SaleService` obtiene `tenantId`, `branchId`, `userId`, `terminalId`, `posSessionId` y `customerId` como hoy.
3. Por cada linea POS directa, `SaleService` llama `PricingService.calculateLinePrice`.
4. Backend ignora `items[].price` del frontend para calculo final.
5. `SaleService` arma items enriquecidos con precio final, descuento, promocion, impuesto y snapshot.
6. `SaleRepository.createSaleWithFunction` serializa esos items al JSON esperado por SQL.
7. `inventory_create_sale_v2` persiste la venta y snapshot, y mantiene stock/FEFO/pagos transaccionales.

Regla de compatibilidad:

- `sale_items.price` debe quedar como `finalUnitPrice`.
- `sale_items.subtotal` debe quedar como `lineTotal`.
- No se recalculan promociones despues de creada la venta.
- No se modifica `products.price`.

## 10. Contrato interno SaleService -> PricingService

`SaleService` debe invocar `PricingService` por linea con este contrato logico:

| Campo | Regla |
| --- | --- |
| `tenantId` | Obligatorio, desde contexto autenticado/sesion actual. |
| `branchId` | Obligatorio, desde contexto POS actual. |
| `productId` | Obligatorio, desde `items[].productId`. |
| `quantity` | Obligatorio, cantidad vendida. |
| `customerId` | Opcional, desde venta si existe. |
| `channel` | Constante `POS`. |
| `date` | Fecha operativa de venta, idealmente una sola por venta. |

El resultado esperado debe incluir al menos:

- `baseUnitPrice`
- `finalUnitPrice`
- `discountAmount`
- `discountPercent`
- `appliedPromotionId`
- `appliedPromotionName`
- `taxId`
- `taxRate`
- `taxBase`
- `taxAmount`
- `lineTotal`
- `explanation` o metadata equivalente para `pricingSnapshot`

## 11. Contrato JSON enriquecido hacia inventory_create_sale_v2

El contrato logico que `SaleService` debe preparar por item:

| Campo logico | Valor |
| --- | --- |
| `productId` | Producto vendido. |
| `quantity` | Cantidad vendida. |
| `price` | `finalUnitPrice`. |
| `subtotal` | `lineTotal`. |
| `priceWithoutTax` | Base unitaria sin impuesto cuando aplique. |
| `taxTotal` | Impuesto total de linea. |
| `baseUnitPrice` | Precio base unitario. |
| `finalUnitPrice` | Precio final unitario. |
| `discountAmount` | Descuento unitario. |
| `discountPercent` | Porcentaje aplicado. |
| `discountTotal` | Descuento total de linea. |
| `appliedPromotionId` | Promocion aplicada, nullable. |
| `appliedPromotionName` | Nombre snapshot de promocion, nullable. |
| `taxId` | Impuesto snapshot, nullable. |
| `taxRate` | Tarifa snapshot. |
| `taxBase` | Base gravable total de linea. |
| `taxAmount` | Impuesto total de linea. |
| `lineTotal` | Total final de linea. |
| `pricingSnapshot` | JSON con entrada/salida de pricing y explicacion. |
| `pricingCalculatedAt` | Timestamp del calculo. |
| `pricingSource` | `POS_PRICING_SERVICE`. |

La funcion SQL actual consume snake_case para varios campos (`product_id`, `order_item_id`). En fases futuras debe definirse una serializacion estable. Recomendacion:

| Campo logico | Campo JSON SQL recomendado |
| --- | --- |
| `productId` | `product_id` |
| `quantity` | `quantity` |
| `price` | `price` |
| `subtotal` | `subtotal` |
| `priceWithoutTax` | `price_without_tax` |
| `taxTotal` | `tax_total` |
| `baseUnitPrice` | `base_unit_price` |
| `finalUnitPrice` | `final_unit_price` |
| `discountAmount` | `discount_amount` |
| `discountPercent` | `discount_percent` |
| `discountTotal` | `discount_total` |
| `appliedPromotionId` | `applied_promotion_id` |
| `appliedPromotionName` | `applied_promotion_name` |
| `taxId` | `tax_id` |
| `taxRate` | `tax_rate` |
| `taxBase` | `tax_base` |
| `taxAmount` | `tax_amount` |
| `lineTotal` | `line_total` |
| `pricingSnapshot` | `pricing_snapshot` |
| `pricingCalculatedAt` | `pricing_calculated_at` |
| `pricingSource` | `pricing_source` |

Ejemplo conceptual:

```json
{
  "product_id": "uuid",
  "quantity": 2,
  "price": 9500,
  "subtotal": 19000,
  "price_without_tax": 7983.19,
  "tax_total": 3033.62,
  "base_unit_price": 10000,
  "final_unit_price": 9500,
  "discount_amount": 500,
  "discount_percent": 5,
  "discount_total": 1000,
  "applied_promotion_id": "uuid",
  "applied_promotion_name": "Promo POS",
  "tax_id": "uuid",
  "tax_rate": 19,
  "tax_base": 15966.38,
  "tax_amount": 3033.62,
  "line_total": 19000,
  "pricing_snapshot": {
    "source": "PricingService",
    "channel": "POS"
  },
  "pricing_calculated_at": "2026-06-02T00:00:00.000Z",
  "pricing_source": "POS_PRICING_SERVICE"
}
```

## 12. Diseno sale_item_taxes

`sale_item_taxes` debe persistir el snapshot fiscal de `PricingService`:

- `tax_id` desde `PricingService`.
- `tax_rate` desde `PricingService`.
- `tax_amount` desde `PricingService`.
- `tax_name` solo como metadata obtenida desde `taxes` por `tax_id`.

Reglas:

- No recalcular `tax_rate` desde `taxes.rate` actual para decidir montos.
- No recalcular `tax_amount` desde producto o impuesto actual.
- Si `taxId` es null o `taxAmount` es cero, no crear `sale_item_taxes` salvo que una regla fiscal futura exija trazabilidad de impuesto cero.
- Si `tax_name` cambio despues, la venta conserva `tax_id`, `tax_rate` y `tax_amount` del snapshot. `tax_name` es metadata descriptiva.

## 13. Pagos y caja

El total de pagos debe validarse contra el total calculado por backend.

Reglas propuestas:

- Para `CASH`, el total pagado debe coincidir con `sales.total` calculado por backend.
- Para ventas con varios medios, la suma de pagos debe coincidir con el total calculado por backend.
- No autoajustar pagos.
- Si frontend envia pagos por monto distinto al total backend, rechazar con error controlado.
- La sesion POS/caja debe seguir resolviendose como hoy.
- El cierre de caja debe leer los pagos persistidos, no recalcular pricing.

Mensaje de error propuesto:

```text
Payment total does not match backend calculated sale total
```

## 14. SaleItemEntity

En fases futuras, `SaleItemEntity` debe aceptar:

```text
pricingSource = POS_PRICING_SERVICE
```

Reglas propuestas:

- Para `pricingSource = POS_PRICING_SERVICE`, validar contra `lineTotal`/snapshot cuando exista.
- Mantener validacion legacy para lineas sin snapshot.
- Mantener soporte existente para `ORDER_ITEM_SNAPSHOT`.
- No permitir que la entidad obligue siempre `subtotal = price * quantity`, porque promociones, impuestos no incluidos o ajustes de redondeo pueden hacer que `lineTotal` sea la fuente canonica.

## 15. Fases recomendadas

### 6.8.2 SaleService prepara pricing payload POS

- Injectar `PricingService` en `SaleService` usando `PricingModule` ya disponible en `InventoryModule`.
- Calcular cada linea POS directa con `PricingService`.
- Ignorar `items[].price` del frontend para calculo final.
- Preparar payload enriquecido para repositorio/SQL.
- Validar pagos contra total backend antes de confirmar venta.
- Agregar tests unitarios de `SaleService` y mapping de payload.

### 6.8.3 inventory_create_sale_v2 persiste snapshot POS

- Actualizar SQL para leer campos enriquecidos.
- Persistir columnas snapshot de V048 en `sale_items`.
- Persistir `sale_items.price = finalUnitPrice`.
- Persistir `sale_items.subtotal = lineTotal`.
- Crear `sale_item_taxes` desde snapshot de pricing.
- Mantener stock, FEFO/lotes y pagos dentro de SQL.
- Mantener fallback legacy solo si se decide compatibilidad temporal.

### 6.8.4 QA API local POS con producto normal, promo, IVA, FEFO y caja

- Validar venta POS sin promocion.
- Validar venta POS con promocion activa.
- Validar IVA incluido.
- Validar caso `taxes.is_included = false` si existe soporte de negocio.
- Validar producto loteado con FEFO.
- Validar pago `CASH` exacto.
- Validar rechazo por pago distinto al total backend.
- Validar que no se modifica `products.price`.
- Validar que no se recalculan promociones despues de creada la venta.

## 16. Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Diferencia entre total frontend y total backend | Venta rechazada o caja descuadrada. | Error controlado y frontend debe refrescar preview en fase posterior. |
| Pagos `CASH` | Cierre de caja puede no cuadrar si se autoajusta. | No autoajustar; exigir total exacto backend. |
| FEFO/lotes | Riesgo de doble consumo si se mueve fuera de SQL. | Mantener FEFO en `inventory_create_sale_v2`. |
| `taxes.is_included = false` | Drift entre `lineTotal`, `price` y `tax_amount`. | Usar outputs de `PricingService`; no recalcular con regla legacy. |
| Reportes que recalculen subtotal como `price * quantity` | Reporte puede diferir de `line_total`. | Reportes deben preferir `line_total`/`subtotal` snapshot. |
| POS frontend muestra precios previos | Usuario ve diferencia al confirmar. | Fase futura debe alinear preview POS con PricingService o mostrar error claro. |
| Promocion muta despues de venta | Historico puede cambiar si se recalcula. | Persistir snapshot y no recalcular. |
| Dependencia circular | Puede bloquear DI. | Usar import existente de `PricingModule` en `InventoryModule`; no importar inventory desde pricing. |

## 17. Criterios de aceptacion para fases futuras

- `POST /api/sales` POS directo usa `PricingService` para cada linea.
- Backend ignora `items[].price` para calculo final.
- `sale_items.price` persiste `finalUnitPrice`.
- `sale_items.subtotal` persiste `lineTotal`.
- `sale_items` persiste todos los campos snapshot de V048 con `pricing_source = POS_PRICING_SERVICE`.
- `sale_item_taxes.tax_id`, `tax_rate` y `tax_amount` vienen del snapshot de pricing.
- No se recalculan promociones despues de creada la venta.
- No se modifica `products.price`.
- Stock y FEFO/lotes siguen funcionando.
- Pagos/caja rechazan diferencias contra total backend.
- Orders no cambia.
- Facturacion electronica no cambia.
- DIAN, GetAcquirer y suppliers no cambian.

## 18. Validaciones propuestas

Validaciones de diseno:

- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`
- `git diff --check`

Validaciones de 6.8.2:

- Tests unitarios de `SaleService.createSale` para payload POS con pricing.
- Tests de rechazo cuando pagos no coinciden con total backend.
- Build de `api`.

Validaciones de 6.8.3:

- Tests o fixture DB para `inventory_create_sale_v2` con item enriquecido.
- Verificar columnas snapshot en `sale_items`.
- Verificar `sale_item_taxes` desde snapshot.
- Verificar FEFO/lotes con producto `requires_lot = true`.

Validaciones de 6.8.4:

- API local con producto normal.
- API local con promocion.
- API local con IVA.
- API local con FEFO/lote.
- API local con caja/pago `CASH`.
- API local con pago incorrecto rechazado.
- Cleanup de fixtures.

## 19. Confirmacion de no alcance en 6.8.1

Esta fase no modifica:

- Logica funcional.
- SQL funcional.
- `inventory_create_sale_v2`.
- `SaleService`.
- `SaleRepository`.
- `SaleItemEntity`.
- Frontend.
- POS UI.
- Orders.
- Facturacion electronica.
- DIAN.
- GetAcquirer.
- Suppliers.
- PRD real.
- Remoto.
- Commits.
