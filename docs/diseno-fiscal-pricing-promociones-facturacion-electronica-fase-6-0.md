# Diseno fiscal de pricing, promociones y base para facturacion electronica - Fase 6.0

## Resumen ejecutivo

Fase 6.0 es solo diseno/documentacion. No define implementacion ejecutable, migraciones, endpoints ni UI.

El diseno propone centralizar el calculo de precios en un `PricingService` usado por POS y Orders. El precio visible/base vigente sigue siendo `products.price`. Las ventas y pedidos deben guardar snapshots del precio, impuesto y promocion calculados al momento de crear la operacion, para que cambios posteriores de precio, impuesto o promocion no recalculen documentos historicos.

La primera implementacion recomendada debe empezar por cambio de precio con historial y motivo obligatorio. Luego debe entrar `PricingService` sin promociones. Despues se agregan promociones simples por producto y sucursal, siempre como descuentos trazables y no como cambios a `products.price`.

## Alcance

- Analizar el modelo actual de productos, impuestos, ventas, pedidos, clientes, medios de pago y funciones SQL criticas.
- Documentar como se manejan hoy precios, impuestos, totales, descuentos y consumidor final.
- Disenar cambio de precio con historial, motivo obligatorio, auditoria y efecto sobre historicos.
- Disenar promociones simples por producto y sucursal.
- Disenar `PricingService` central para POS y Orders.
- Disenar impacto fiscal minimo para futura facturacion electronica.
- Definir fases recomendadas desde Fase 6.1 hasta Fase 6.7.

## Fuera de alcance

- No implementar codigo funcional.
- No crear migraciones.
- No crear endpoints.
- No modificar frontend.
- No modificar backend.
- No tocar SQL.
- No tocar PRD real.
- No tocar servidor remoto.
- No hacer commit.
- No ejecutar build, tests ni migraciones.
- No implementar cupones.
- No implementar promociones por cliente.
- No mostrar promociones en ticket en primera version.
- No implementar facturacion electronica.

## Decisiones funcionales

- `products.price` representa el precio visible/base vigente del producto.
- Las ventas historicas no se recalculan si cambia `products.price`.
- Los cambios de precio requieren motivo obligatorio.
- Primera version de cambio de precio no requiere aprobacion.
- Promociones no modifican `products.price`.
- Promociones se guardan como descuentos trazables.
- Promociones no son acumulables por defecto.
- Si varias promociones aplican, gana la promocion de mayor prioridad.
- Promociones pueden aplicar por producto y opcionalmente por sucursal.
- POS y Orders deben usar el mismo `PricingService`.
- Pedidos conservan el precio/promocion calculado al crearse.
- Al facturar pedido no se recalcula promocion.
- Cliente consumidor final debe ser fallback cuando no hay cliente.
- Facturacion electronica futura sera entidad separada de `sales`.
- No se implementan cupones ni promociones por cliente en primera version.
- No se muestran promociones en ticket en primera version.

## Modelo actual observado

### `products`

Fuente observada: `scripts/database/products/2026_04_25_inventory_products.sql`, `api/src/modules/inventory/entities/product.entity.ts`, `api/src/modules/inventory/repositories/product.repository.ts`, `api/src/modules/inventory/services/product.service.ts`.

Campos relevantes actuales:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Filtra multi-tenant. |
| `unit_id` | Unidad del producto. |
| `tax_id` | Referencia opcional a `taxes`. |
| `sku` | Unico por tenant. |
| `price` | Precio visible/base usado por POS y Orders. |
| `cost` | Costo operativo; no debe usarse como precio de venta. |
| `price_with_tax` | Campo persistido; en create se defaulta a `price` si no viene. |
| `price_without_tax` | Campo persistido; en create se defaulta a `price` si no viene. |
| `is_active` | Control basico de disponibilidad. |
| Campos enriquecidos | `is_perishable`, `requires_lot`, `requires_expiration`, `operational_status`, `rotation_class`, `min_stock`, `max_stock` ya aparecen en entidad/repositorio por fases anteriores. |

El update actual de producto permite actualizar `price`, `price_with_tax` y `price_without_tax` directamente. No hay flujo funcional de motivo obligatorio ni escritura transaccional de historial de precio.

### `taxes`

Fuente observada: `scripts/database/products/2026_04_25_inventory_products.sql`, `api/src/modules/inventory/entities/tax.entity.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Impuesto por tenant. |
| `name` | Nombre, por ejemplo IVA. |
| `rate` | Tasa numerica. El flujo actual usa valores tipo `0.19` para 19%. |
| `is_included` | Existe, pero las funciones de venta observadas calculan `price_without_tax` dividiendo el precio por `1 + rate` cuando hay tasa. En la practica el precio vendido se trata como precio visible con impuesto incluido. |

### `sales`

Fuente observada: `scripts/database/sale/001_sales.sql`, parches de finance, `api/src/modules/inventory/entities/sale.entity.ts`, `api/src/modules/inventory/repositories/sale.repository.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Tenant de la venta. |
| `branch_id` | Sucursal POS. |
| `terminal_id` | Terminal POS. |
| `user_id` | Cajero/usuario. |
| `pos_session_id` | Sesion POS. |
| `customer_id` | Obligatorio. |
| `order_id` | Opcional si nace desde pedido. |
| `type` | `CASH` o `CREDIT`. |
| `status` | `DRAFT`, `CONFIRMED`, `CANCELLED`, `REFUNDED` en entidad actual. |
| `total` | Total de venta. |
| `balance`, `payment_status`, `total_paid`, `balance_due` | Campos financieros agregados por patches de finance. |

### `sale_items`

Fuente observada: `scripts/database/sale/002_sale_items.sql`, `api/src/modules/inventory/entities/sale-item.entity.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Tenant del item. |
| `sale_id` | Venta padre. |
| `product_id` | Producto vendido. |
| `order_item_id` | Opcional cuando se factura pedido. |
| `quantity` | Cantidad vendida. |
| `price` | Precio unitario final guardado en la venta. Es snapshot historico. |
| `price_without_tax` | Base unitaria sin impuesto calculada al vender/facturar. |
| `tax_total` | Impuesto total de la linea. |
| `subtotal` | `price * quantity`. Hoy actua como total de linea visible. |

No existe columna `discount_amount`, `discount_percent`, `promotion_id`, `line_total` separada ni snapshot formal de promocion aplicada.

### `sale_item_taxes`

Fuente observada: `scripts/database/sale/003_sale_item_taxes.sql`.

Guarda impuesto por item vendido:

| Campo | Observacion |
| --- | --- |
| `sale_item_id` | Linea de venta. |
| `tax_id` | Impuesto aplicado. |
| `tax_name` | Snapshot del nombre. |
| `tax_rate` | Snapshot de tasa. |
| `tax_amount` | Valor calculado. |
| `is_included` | Snapshot del flag del impuesto. |

Este modelo ya apunta a auditoria fiscal, pero solo existe para ventas, no para `order_items`.

### `orders`

Fuente observada: `scripts/database/products/2026_04_26_inventory_orders.sql`, parches de finance, `api/src/modules/inventory/entities/order.entity.ts`, `api/src/modules/inventory/services/order.service.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Tenant del pedido. |
| `customer_id` | Obligatorio. |
| `type` | `CASH` o `CREDIT`. |
| `status` | Entidad actual contempla `DRAFT`, `CONFIRMED`, `PARTIAL`, `COMPLETED`, `CANCELLED`. |
| `total` | Total del pedido al crearlo/editarlo. |
| `payment_status`, `total_paid`, `balance_due` | Campos financieros agregados. |

### `order_items`

Fuente observada: `scripts/database/products/2026_04_26_inventory_order_items.sql`, `scripts/database/products/2026_04_30_inventory_order_billing.sql`, `api/src/modules/inventory/entities/order-item.entity.ts`, `api/src/modules/inventory/services/order.service.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `order_id` | Pedido padre. |
| `product_id` | Producto pedido. |
| `ordered_quantity` | Cantidad solicitada. |
| `delivered_quantity` | Cantidad entregada. |
| `billed_quantity` | Cantidad facturada desde pedido. |
| `price` | Precio unitario snapshot del pedido. |
| `subtotal` | Subtotal guardado del item. |

No hay snapshot de impuesto ni promocion en `order_items`. Al facturar pedido, `inventory_invoice_order` toma `order_items.price`, calcula impuesto, crea `sale_items` y sube `billed_quantity`.

### `customers`

Fuente observada: `scripts/database/products/2026_04_26_inventory_customers.sql`, `scripts/database/011_prd_default_customer.sql`, `api/src/modules/inventory/entities/customer.entity.ts`.

Campos relevantes:

| Campo | Observacion |
| --- | --- |
| `tenant_id` | Cliente por tenant. |
| `name`, `document_number`, `phone`, `email`, `address` | Datos comerciales basicos. |
| Ubicacion | `departamento_id`, `municipio_id`, `ciudad`, `departamento`. |
| `is_active` | Estado. |
| `is_default` | Agregado por script `011_prd_default_customer.sql`; hay indice unico parcial por tenant. |

El script crea `CONSUMIDOR FINAL` con documento `0000000000` para cada tenant cuando falta default. En POS, el frontend intenta seleccionar cliente cuyo nombre incluye `consumidor final`; si no existe, toma el primer cliente activo. En backend, `SaleService` exige `customerId`; no se observo fallback backend automatico.

### `payment_methods` y pagos

Fuente observada: `scripts/database/finance/migrations/20260430_1753_finance_base_infrastructure.sql`, `scripts/database/sale/004_sale_payment_methods.sql`, `api/src/modules/inventory/repositories/sale.repository.ts`.

`payment_methods` es el catalogo finance moderno:

| Campo | Observacion |
| --- | --- |
| `codigo`, `nombre` | Identificacion del medio. |
| `tipo` | `CASH`, `CARD`, `BANK`, `DIGITAL`, `CREDIT`. |
| `requires_reference` | Requiere referencia. |
| `allows_change` | Manejo de cambio. |
| `active` | Estado. |

`sale_payment_methods` es snapshot legacy para venta:

| Campo | Observacion |
| --- | --- |
| `payment_method` | `CASH`, `CARD`, `TRANSFER`, `OTHER`. |
| `amount` | Monto pagado. |
| `reference` | Referencia opcional. |

### `inventory_create_sale_v2`

Fuente observada: `api/src/modules/inventory/repositories/sale.repository.ts`, documentos previos de Fase 3/4.

El camino normal de `SaleRepository` usa `inventory_create_sale_v2`. El payload hacia la funcion incluye por item:

| Campo | Observacion |
| --- | --- |
| `product_id` | Producto. |
| `quantity` | Cantidad. |
| `price` | Precio unitario enviado desde POS/API. |
| `order_item_id` | Opcional. |

La funcion SQL es el punto transaccional de venta POS, stock y FEFO. Para pricing futuro, no debe recibir precios calculados en frontend como unica verdad. Debe recibir o validar el snapshot calculado por `PricingService`.

### Flujo de facturacion de pedidos

Fuente observada: `api/src/modules/inventory/repositories/sale.repository.ts`, `scripts/database/migrations/20260504_invoice_order_function.sql`.

`SaleRepository.invoiceOrderWithFunction` llama `inventory_invoice_order(...)`. La funcion:

- Bloquea el pedido `PARTIAL` o `COMPLETED`.
- Toma items entregados y no facturados.
- Usa `order_items.price` como precio unitario.
- Calcula `price_without_tax`, `tax_total` y `subtotal`.
- Inserta `sale_items` y `sale_item_taxes`.
- Incrementa `order_items.billed_quantity`.
- Crea/relaciona pagos de venta.
- No recalcula precio desde `products.price`.

Observacion clave: si el pedido guardo un precio, la facturacion respeta ese precio. Esta regla debe mantenerse para promociones.

## Como se maneja hoy

### `products.price`

`products.price` es el precio usado por POS y Orders como precio visible. El frontend POS agrega al carrito `Number(product.price)`. Orders autocompleta el precio desde `product.price` al seleccionar producto, pero mantiene precio editable.

### `products.price_with_tax`

Se persiste en `products`. En `ProductService.createProduct`, si no viene, toma `product.price`. No se observo que sea la fuente transaccional principal para ventas.

### `products.price_without_tax`

Se persiste en `products`. En `ProductService.createProduct`, si no viene, toma `product.price`. POS lo usa para mostrar desglose local de impuestos, pero backend/SQL vuelve a calcular base sin impuesto desde el precio y la tasa.

### `products.tax_id`

Referencia opcional a `taxes`. En venta y facturacion de pedido, se consulta `products.tax_id` y `taxes.rate` para crear `sale_item_taxes`.

### `sale_items` price/subtotal/tax/total

- `price`: precio unitario final vendido.
- `price_without_tax`: base unitaria sin impuesto.
- `tax_total`: impuesto total de linea.
- `subtotal`: `price * quantity`; hoy equivale al total visible de linea.
- No hay `line_total` separado.
- No hay descuento ni promocion.

### `order_items` price/subtotal/tax/total

- `price`: precio unitario guardado al crear/editar pedido.
- `subtotal`: total de linea guardado.
- No hay `tax_total`, `price_without_tax`, `line_total` ni tabla de impuestos de pedido.
- Al facturar, se calculan impuestos desde el precio guardado y se copian a `sale_items`/`sale_item_taxes`.

### Descuentos

No se observo modelo funcional de descuentos en `sale_items`, `order_items`, POS u Orders. Las menciones de "descuento" en docs previas se refieren a descuento de inventario/stock FEFO, no descuento comercial.

### Impuestos

Los impuestos se materializan en ventas mediante `sale_item_taxes`. El calculo actual trata el precio como precio visible con impuesto incluido cuando `tax_rate > 0`:

- `price_without_tax = price / (1 + tax_rate)`.
- `tax_total = (price - price_without_tax) * quantity`.
- `subtotal = price * quantity`.

Riesgo: `taxes.is_included` existe, pero la logica observada no lo usa como bifurcacion real del calculo.

### Cliente/consumidor final

Existe preparacion de DB para `customers.is_default` y un cliente `CONSUMIDOR FINAL`. POS selecciona fallback por nombre o primer cliente activo. Backend de ventas hoy exige `customerId`. El diseno futuro debe mover el fallback a backend/Pricing/checkout para evitar ventas sin cliente si el frontend falla.

## Brechas actuales

- El cambio directo de producto puede modificar `products.price` sin motivo obligatorio.
- `product_price_history` existe como modelo preparatorio en fases previas, pero no se observo flujo funcional de cambio de precio usando esa tabla.
- No hay `PricingService` central.
- POS calcula y envia precio desde frontend.
- Orders calcula precio desde frontend y permite edicion manual.
- La funcion SQL de venta recalcula impuestos, pero no tiene contexto de promocion.
- `order_items` no guarda snapshots fiscales de impuesto.
- No existe modelo de promociones.
- No existen snapshots de promocion aplicada en ventas o pedidos.
- No existe regla comun para resolver conflictos entre promociones.
- No hay separacion fiscal futura entre venta comercial y factura electronica.
- El fallback de consumidor final depende parcialmente del frontend.

## Modelo conceptual propuesto

```text
products.price
  -> cambio de precio con historial
  -> PricingService
     -> calcula precio base, promocion, impuesto y total
     -> POS guarda snapshot en sale_items + sale_item_promotions
     -> Orders guarda snapshot en order_items + order_item_promotions
     -> facturacion de pedido copia snapshot a venta, no recalcula promocion
     -> electronic_invoices futuro lee snapshots inmutables
```

Responsabilidades:

| Componente | Responsabilidad |
| --- | --- |
| `products.price` | Precio visible/base vigente. |
| `product_price_history` | Auditoria de cambios de precio, motivo, usuario y vigencia. |
| `promotions` | Reglas comerciales temporales de descuento. |
| `PricingService` | Fuente unica de calculo para POS y Orders. |
| POS | Consumir calculo y guardar snapshot al vender. |
| Orders | Consumir calculo y guardar snapshot al crear pedido. |
| Facturacion de pedido | Copiar precio/promocion ya guardados; no reevaluar promocion. |
| Facturacion electronica futura | Emitir documento fiscal separado desde snapshots de venta/pedido. |

## Modelo de datos propuesto

Nota: esta seccion es conceptual. No es SQL ejecutable.

### `product_price_history`

Tabla para auditoria de cambios de precio.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `product_id` | Producto afectado. |
| `previous_price` | Precio anterior. |
| `new_price` | Precio nuevo aplicado a `products.price`. |
| `reason` | Motivo obligatorio, trim, minimo recomendado 5 caracteres. |
| `changed_by` | Usuario que realizo el cambio. |
| `valid_from` | Inicio de vigencia. |
| `valid_to` | Fin de vigencia del registro anterior. |
| `status` | `APPLIED` en primera version; preparado para `PENDING_APPROVAL`, `REJECTED`. |
| `approved_by` | Nulo en primera version. |
| `approved_at` | Nulo en primera version. |
| `created_at` | Fecha de auditoria. |

Reglas:

- Un producto debe tener como maximo un registro `APPLIED` vigente sin `valid_to`.
- Cambiar precio debe cerrar el registro vigente anterior.
- El cambio debe actualizar `products.price` y crear historial en la misma transaccion.
- Primera version no requiere aprobacion.
- `reason` siempre obligatorio.

### `promotions`

Tabla cabecera de promociones.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `name` | Nombre visible interno. |
| `description` | Descripcion opcional. |
| `discount_type` | `PERCENT` o `FIXED_AMOUNT`. |
| `discount_value` | Porcentaje o valor fijo. |
| `priority` | Mayor numero gana. |
| `starts_at` | Inicio de vigencia. |
| `ends_at` | Fin de vigencia nullable. |
| `is_active` | Activa/inactiva. |
| `is_stackable` | Default `false`. Preparado para futuro. |
| `channel` | `POS`, `ORDER` o `ALL`. |
| `created_by`, `updated_by` | Auditoria. |
| `created_at`, `updated_at` | Fechas. |

Reglas:

- `discount_value > 0`.
- Para `PERCENT`, `discount_value <= 100`.
- Para `FIXED_AMOUNT`, el descuento efectivo no puede dejar precio final menor a 0.
- `starts_at < ends_at` cuando `ends_at` no es nulo.
- Inactiva no aplica aunque este vigente.

### `promotion_products`

Relacion de promociones con productos.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `promotion_id` | Promocion. |
| `product_id` | Producto elegible. |
| `created_at` | Auditoria. |

Regla: combinacion `tenant_id`, `promotion_id`, `product_id` debe ser unica.

### `promotion_branches`

Relacion opcional de promociones con sucursales.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `promotion_id` | Promocion. |
| `branch_id` | Sucursal elegible. |
| `created_at` | Auditoria. |

Regla: si una promocion no tiene filas en `promotion_branches`, aplica a todas las sucursales del tenant. Si tiene filas, solo aplica a esas sucursales.

### `sale_item_promotions`

Snapshot de promocion aplicada a una linea de venta.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `sale_id` | Venta. |
| `sale_item_id` | Linea de venta. |
| `promotion_id` | Promocion original nullable si se borra logicamente en futuro. |
| `promotion_name` | Snapshot del nombre. |
| `discount_type` | Snapshot del tipo. |
| `discount_value` | Snapshot del valor configurado. |
| `priority` | Snapshot de prioridad. |
| `base_unit_price` | Precio antes de descuento. |
| `final_unit_price` | Precio despues de descuento. |
| `discount_amount` | Descuento total de linea. |
| `discount_percent` | Porcentaje efectivo. |
| `applied_at` | Fecha de aplicacion. |

Regla: la venta debe poder explicarse sin consultar la promocion viva.

### `order_item_promotions`

Snapshot de promocion aplicada a una linea de pedido.

| Campo | Proposito |
| --- | --- |
| `id` | Identificador. |
| `tenant_id` | Tenant. |
| `order_id` | Pedido. |
| `order_item_id` | Linea de pedido. |
| Campos snapshot | Igual que `sale_item_promotions`. |

Regla: al facturar pedido, se copia el snapshot de pedido hacia la venta o se referencia desde la venta resultante. No se recalcula elegibilidad de promocion.

### Ajustes futuros en `sale_items` y `order_items`

Para trazabilidad fiscal completa, fases futuras deberian agregar o materializar estos datos por linea:

| Dato | Motivo |
| --- | --- |
| `base_unit_price` | Precio antes de promocion. |
| `final_unit_price` | Precio final vendido/pedido. |
| `discount_amount` | Descuento monetario total. |
| `discount_percent` | Porcentaje efectivo. |
| `tax_id`, `tax_rate` snapshot | Evitar dependencia de cambios futuros en `taxes`. |
| `tax_base` | Base gravable de linea. |
| `tax_amount` | Impuesto de linea. |
| `line_subtotal` | Base comercial antes de impuesto si se decide separarla. |
| `line_total` | Total final de linea. |
| `pricing_explanation` | Explicacion corta para auditoria y soporte. |

En ventas, parte de esto ya existe en `sale_items` y `sale_item_taxes`. En pedidos falta snapshot de impuesto.

## Flujos de cambio de precio

### Backend

1. Usuario autorizado solicita cambio de precio.
2. Backend valida tenant, producto activo y permiso de escritura.
3. Backend valida `newPrice >= 0`.
4. Backend valida `reason` obligatorio, trim, minimo recomendado 5 caracteres.
5. Backend abre transaccion.
6. Backend bloquea el producto para evitar cambios concurrentes.
7. Backend lee `products.price` actual.
8. Backend cierra historial vigente anterior con `valid_to = now()`.
9. Backend actualiza `products.price = newPrice`.
10. Backend debe recalcular o sincronizar `price_with_tax` y `price_without_tax` segun regla fiscal aprobada.
11. Backend inserta `product_price_history` con `status = APPLIED`, `approved_by = null`, `approved_at = null`.
12. Backend registra auditoria funcional.
13. Backend confirma transaccion.

### Frontend

1. Usuario abre producto o accion "Cambiar precio".
2. UI muestra precio vigente y campo de nuevo precio.
3. UI exige motivo obligatorio.
4. UI muestra advertencia: ventas y pedidos existentes no se recalculan.
5. UI confirma cambio.
6. UI refresca detalle/listado y muestra historial.

### Permisos

Permisos recomendados:

| Permiso | Uso |
| --- | --- |
| `products.price.change` | Cambiar precio. |
| `products.price.history.read` | Ver historial. |
| `products.price.approve` | Futuro, no activo en primera version. |

### Auditoria

Debe registrar:

- `tenant_id`.
- `product_id`.
- `changed_by`.
- `previous_price`.
- `new_price`.
- `reason`.
- `valid_from`.
- IP/user agent si el sistema ya lo maneja.
- Evento `PRODUCT_PRICE_CHANGED`.

### Validaciones

- Producto pertenece al tenant.
- Producto existe y esta activo para cambio.
- Precio nuevo numerico y no negativo.
- Motivo no vacio.
- Motivo con longitud minima.
- No permitir no-op silencioso; si precio nuevo igual a actual, rechazar o registrar evento separado. Recomendacion: rechazar para no ensuciar historial.
- Concurrencia: bloquear producto o historial vigente en transaccion.

### Impacto en ventas historicas

No hay recalculo. `sale_items.price`, `sale_items.price_without_tax`, `sale_items.tax_total`, `sale_item_taxes` y totales de `sales` quedan inmutables salvo anulacion/reverso normal.

### Impacto en pedidos existentes

No hay recalculo. `order_items.price` y `orders.total` quedan como snapshot del pedido. Si negocio quiere refrescar precios de un pedido `DRAFT`, debe ser accion explicita futura, con auditoria.

## Flujos de promociones

### Creacion/edicion

1. Usuario autorizado crea promocion.
2. Define nombre, tipo, valor, prioridad, vigencia, canal y estado.
3. Asocia productos.
4. Opcionalmente asocia sucursales.
5. Backend valida no vacios, rangos, vigencia y tenant.
6. Promocion queda activa/inactiva segun estado.

### Aplicacion en PricingService

1. Recibe `tenantId`, `branchId`, `productId`, `quantity`, `customerId`, `channel`, `date`.
2. Lee producto y precio base desde `products.price`.
3. Busca promociones activas, vigentes, del producto, del canal y de la sucursal.
4. Si ninguna aplica, retorna precio base.
5. Si varias aplican, escoge la de mayor `priority`.
6. Si hay empate de prioridad, recomendacion: ordenar por `starts_at DESC`, luego `id ASC` para resultado deterministico.
7. Calcula descuento.
8. Calcula precio final y taxes.
9. Retorna explicacion.

### No acumulables por defecto

`is_stackable=false` en primera version. Aunque el modelo tenga campo de preparacion, el algoritmo inicial debe aplicar una sola promocion.

### Snapshots

Cuando se confirma venta o se crea pedido:

- Guardar `promotion_id`.
- Guardar nombre y regla aplicada.
- Guardar prioridad.
- Guardar precio base, descuento y precio final.
- Guardar explicacion corta.

Si luego se desactiva o edita la promocion, la venta/pedido historico conserva su snapshot.

## PricingService

### Entrada

```text
tenantId
branchId
productId
quantity
customerId opcional
channel: POS | ORDER
date
```

### Salida

```text
baseUnitPrice
finalUnitPrice
discountAmount
discountPercent
appliedPromotionId
appliedPromotionName
taxId
taxRate
taxBase
taxAmount
lineSubtotal
lineTotal
explanation
```

### Reglas de calculo

1. `baseUnitPrice = products.price`.
2. `lineSubtotal = baseUnitPrice * quantity` antes de descuento.
3. Si no hay promocion, `finalUnitPrice = baseUnitPrice`.
4. Si promocion `PERCENT`, descuento unitario = `baseUnitPrice * percent / 100`.
5. Si promocion `FIXED_AMOUNT`, descuento unitario = valor fijo limitado por `baseUnitPrice`.
6. `finalUnitPrice` nunca puede ser menor que 0.
7. `discountAmount = (baseUnitPrice - finalUnitPrice) * quantity`.
8. `discountPercent` es porcentaje efectivo sobre `baseUnitPrice`.
9. `lineTotal = finalUnitPrice * quantity`.
10. Si hay `tax_id`, leer `taxes.rate`.
11. Regla inicial recomendada: precio visible con impuesto incluido, igual al comportamiento actual.
12. `taxBase = lineTotal / (1 + taxRate)` si `taxRate > 0`; si no, `taxBase = lineTotal`.
13. `taxAmount = lineTotal - taxBase`.
14. `explanation` debe indicar precio base, promocion aplicada o motivo de no aplicar, impuesto y total.

### Contrato interno recomendado

`PricingService` debe ser usado por:

- POS al calcular una linea.
- Orders al crear o editar una linea.
- Backend al confirmar venta/pedido para validar snapshot.
- Reporteria futura para explicar, no para recalcular historicos.

### Errores esperados

- Producto no existe o no pertenece al tenant.
- Producto inactivo/no vendible.
- Sucursal no pertenece al tenant.
- Cantidad invalida.
- Impuesto referenciado no pertenece al tenant.
- Promocion mal configurada.

## Impacto en POS

Estado actual:

- Carga productos desde `/products?branchId=...`.
- Agrega carrito con `product.price`.
- Calcula subtotal local `price * quantity`.
- Usa `product.priceWithoutTax` y catalogo de taxes para desglose visual.
- Envia `items[].price` a `/sales`.
- Backend usa `inventory_create_sale_v2`.

Diseno futuro:

- POS debe consultar/calcular con `PricingService` al agregar producto y al cambiar cantidad.
- POS debe mostrar precio final, pero no necesita mostrar promocion en ticket primera version.
- Backend debe revalidar el snapshot recibido antes de confirmar.
- Si precio/promocion cambio entre carrito y cobro, backend debe responder conflicto controlado o recalcular y pedir confirmacion.
- `sale_items.price` debe guardar `finalUnitPrice`.
- `sale_item_promotions` debe guardar el snapshot de promocion si aplica.
- Tickets existentes no cambian en primera version.

## Impacto en Orders

Estado actual:

- Crear pedido toma precio desde `product.price` en UI.
- Usuario puede editar precio manualmente.
- `order_items.price` guarda el precio del pedido.
- Facturacion usa `order_items.price` y no `products.price`.

Diseno futuro:

- Crear pedido debe llamar `PricingService` por linea.
- `order_items.price` debe representar `finalUnitPrice` del snapshot.
- `order_item_promotions` debe guardar la promocion aplicada.
- Al editar cantidad/producto en pedido `DRAFT`, recalcular solo esa linea con accion explicita normal.
- Al facturar pedido, no recalcular promocion.
- Al facturar, copiar snapshot fiscal/promocional del pedido hacia venta.
- Pedidos `CONFIRMED`, `PARTIAL` o `COMPLETED` no deben refrescar precio automaticamente.

## Impacto en impuestos

Regla inicial recomendada: precio visible incluye impuesto cuando hay `taxRate > 0`, porque coincide con el comportamiento actual de venta/facturacion.

Necesidades futuras:

- Aclarar si `taxes.is_included` debe gobernar calculo incluido vs excluido.
- Guardar snapshot de `tax_id`, `tax_rate`, `tax_base`, `tax_amount` en pedidos.
- Mantener `sale_item_taxes` como snapshot fiscal de ventas.
- Evitar recalcular impuestos historicos si cambia `taxes.rate`.
- Definir redondeo oficial por linea vs por documento antes de facturacion electronica.

## Base para facturacion electronica

La facturacion electronica futura debe ser entidad separada de `sales`. `sales` representa la transaccion comercial/POS. La factura electronica representa el documento fiscal emitido ante proveedor tecnologico/DIAN o equivalente.

### Entidades futuras

#### `electronic_invoices`

| Campo | Proposito |
| --- | --- |
| `id` | Identificador interno. |
| `tenant_id` | Tenant emisor. |
| `sale_id` | Venta origen nullable si se soportan otros origenes. |
| `order_id` | Pedido origen opcional. |
| `customer_id` | Cliente fiscal usado. |
| `status` | `DRAFT`, `READY`, `SUBMITTED`, `ACCEPTED`, `REJECTED`, `CANCELLED`. |
| `document_type` | Factura, nota credito, nota debito futura. |
| `prefix`, `number` | Numeracion fiscal. |
| `issue_date` | Fecha de emision. |
| `currency` | Moneda. |
| `subtotal`, `tax_total`, `discount_total`, `total` | Totales fiscales. |
| `cufe` | Identificador fiscal futuro. |
| `provider_payload` | Payload enviado. |
| `provider_response` | Respuesta recibida. |
| `created_by`, `created_at`, `updated_at` | Auditoria. |

#### `electronic_invoice_items`

Debe guardar snapshot fiscal completo por linea:

- Producto/descripcion.
- Cantidad.
- Precio base.
- Descuento.
- Precio final.
- Base gravable.
- Impuesto.
- Total.
- Referencia a `sale_item_id` u `order_item_id`.

#### `electronic_invoice_events`

Debe guardar:

- Estado anterior/nuevo.
- Request/response resumido.
- Error tecnico/fiscal si existe.
- Usuario o job que ejecuto.
- Fecha.

### Reglas de separacion

- No emitir factura electronica recalculando promociones.
- No emitir factura electronica recalculando precio de producto vigente.
- La factura electronica lee snapshots de venta/pedido.
- Si no hay cliente, usar consumidor final por tenant.
- Rechazos fiscales no deben alterar `sale_items` historicos.

## Fases recomendadas

### Fase 6.1 Cambio de precio con historial

- Crear flujo funcional de cambio de precio.
- Usar `product_price_history`.
- Exigir motivo obligatorio.
- Actualizar `products.price` en transaccion.
- No exigir aprobacion inicial.
- Agregar permisos y auditoria.

### Fase 6.2 PricingService base sin promociones

- Crear `PricingService`.
- Entrada/salida estable.
- Calcular desde `products.price`.
- Calcular impuestos segun regla actual.
- No aplicar promociones todavia.
- Agregar pruebas unitarias del calculo.

### Fase 6.3 Promociones simples por producto/sucursal

- Crear modelo funcional de promociones.
- Aplicar por producto y opcionalmente sucursal.
- Usar prioridad.
- No acumular.
- Guardar snapshots.

### Fase 6.4 Aplicar pricing en Orders

- Usar `PricingService` al crear/editar pedido.
- Guardar snapshot en `order_items` y `order_item_promotions`.
- Facturar pedido sin recalcular promocion.

### Fase 6.5 Aplicar pricing en POS

- Usar `PricingService` en POS y backend.
- Guardar snapshot en `sale_items` y `sale_item_promotions`.
- Mantener tickets sin mostrar promocion en primera version.

### Fase 6.6 Reportes de precios/promociones/descuentos

- Reporte de historial de precios.
- Reporte de promociones activas/inactivas.
- Reporte de descuentos aplicados por rango, producto, sucursal y usuario.
- Reporte de impacto de promociones.

### Fase 6.7 Preparacion documental para facturacion electronica

- Documentar snapshots fiscales requeridos.
- Definir entidad `electronic_invoices`.
- Definir estados y eventos.
- Definir relacion con cliente consumidor final.
- Definir redondeo fiscal.
- No implementar emision todavia.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Duplicar reglas entre POS, Orders y SQL | `PricingService` como fuente unica y validacion backend. |
| Recalcular pedidos al facturar | Usar snapshots de `order_items` y `order_item_promotions`. |
| Cambiar precio sin historial | Bloquear update directo de precio en flujo funcional futuro. |
| Promociones no deterministicas | Prioridad obligatoria y tie-break estable. |
| Impuesto inconsistente por `is_included` | Definir regla oficial antes de facturacion electronica. |
| Tickets/reportes historicos cambian | No recalcular historicos; guardar snapshots. |
| Consumidor final faltante | Fallback backend por `customers.is_default`. |
| Concurrencia en cambio de precio | Transaccion con bloqueo de producto. |
| Redondeo fiscal distinto al requerido | Definir redondeo por linea/documento en Fase 6.7. |

## Preguntas abiertas

- Debe `taxes.is_included` gobernar calculo de impuesto o se mantiene precio siempre incluido?
- Debe permitirse precio futuro programado en `product_price_history`?
- Si el usuario edita precio manual en Orders, se considera override con motivo?
- Si dos promociones tienen misma prioridad, negocio prefiere mayor descuento o antiguedad? Recomendacion tecnica: tie-break deterministico, no "mayor descuento" salvo aprobacion.
- Debe una promocion poder aplicar a todas las sucursales por ausencia de `promotion_branches`?
- Que permisos exactos de menu se usaran para promociones?
- Como se mostrara descuento en reportes si no se muestra en ticket?
- Facturacion electronica usara numeracion por sucursal, caja o tenant?
- Cual es el redondeo fiscal oficial para Colombia en este sistema: por linea, por impuesto agrupado o por documento?

## Criterios de aceptacion

- Documento de diseno creado en `docs/diseno-fiscal-pricing-promociones-facturacion-electronica-fase-6-0.md`.
- No hay cambios funcionales.
- No hay migraciones nuevas.
- No hay endpoints nuevos.
- No hay cambios en frontend.
- No hay cambios en backend.
- No hay cambios SQL.
- OpenSpec valida con `openspec validate fortalecer-productos-inventario --type change --strict --json`.
- `git diff --check` pasa.
- `openspec/changes/fortalecer-productos-inventario/tasks.md` registra Fase 6.0 como completada solo despues de cumplir los puntos anteriores.
